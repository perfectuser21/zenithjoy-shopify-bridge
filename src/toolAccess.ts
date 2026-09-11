type ToolRegistrar = (name: string, ...args: unknown[]) => unknown;

type ToolServer = {
  tool: unknown;
  registerTool?: unknown;
};

type ToolRegistrarKey = "tool" | "registerTool";

/**
 * Tools that cannot mutate Shopify catalogue, customer, order, file, redirect,
 * inventory, or local upload-session state.
 *
 * Read-only mode is fail-closed: new tools are hidden until explicitly added
 * here after review.
 */
export const READ_ONLY_TOOL_NAMES = new Set([
  "products",
  "get-customers",
  "orders",
  "get-collections",
  "get-inventory-levels",
  "get-metafields",
  "list-metafield-definitions",
  "get-metafield-options",
  "list-metaobject-definitions",
  "get-metaobject-definition",
  "list-metaobjects",
  "get-metaobject",
  "get-locations",
  "draft-orders",
  "get-redirects",
  "get-store-counts",
  "count-products-by-tag",
  "get-product-issues",
  "get-bulk-operation-status",
  "get-bulk-operation-results",
  "get-status",
  "get-files",
  "get-file-upload-session",
  "search-taxonomy",
  "find-products-by-metafield",
]);

/**
 * Sensitive write tools called out explicitly in addition to the fail-closed
 * read allowlist. A tool listed in both sets is always treated as a write.
 */
export const WRITE_TOOL_NAMES = new Set([
  "create-metafield-definition",
  "update-metaobject-definition",
  "update-inventory-item-customs",
  "update-inventory-item-shipping",
]);

/**
 * P0 draft-only allowlist: the full read-only set, plus "create-product"
 * (the single mutation this deployment mode is scoped to). Draft-vs-live
 * enforcement itself lives in createProduct.ts (status is forced to DRAFT
 * when SHOPIFY_MCP_TOOL_ACCESS_MODE=p0-draft-only) — this allowlist only
 * controls which tools are reachable at all.
 */
export const P0_DRAFT_ONLY_TOOL_NAMES = new Set([
  ...READ_ONLY_TOOL_NAMES,
  "create-product",
]);

function parseBooleanFlag(value: unknown, truthyStrings: string[]): boolean {
  if (value === true) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return truthyStrings.includes(value.trim().toLowerCase());
}

export function parseReadOnlyMode(value: unknown): boolean {
  return parseBooleanFlag(value, ["true", "1", "yes", "on"]);
}

/**
 * Draft-only mode accepts the same truthy strings as read-only mode, plus
 * the explicit mode name "p0-draft-only" (so SHOPIFY_MCP_TOOL_ACCESS_MODE
 * can be set to either "true" or "p0-draft-only" interchangeably).
 */
export function parseDraftOnlyMode(value: unknown): boolean {
  return parseBooleanFlag(value, ["true", "1", "yes", "on", "p0-draft-only"]);
}

/**
 * Wrap an MCP server's tool registrar so only tool names present in
 * `allowlist` can be registered. Fail-closed: anything not in the allowlist
 * (including future tools not yet classified) is silently dropped.
 */
function wrapRegistrarWithAllowlist<T extends ToolServer>(
  server: T,
  allowlist: Set<string>,
): T {
  const wrapRegistrar = (key: ToolRegistrarKey): void => {
    const registrar = server[key];
    if (typeof registrar !== "function") {
      return;
    }

    const registerTool = (registrar as ToolRegistrar).bind(server);
    server[key] = ((name: string, ...args: unknown[]) => {
      if (!allowlist.has(name)) {
        return undefined;
      }

      return registerTool(name, ...args);
    }) as T[typeof key];
  };

  wrapRegistrar("tool");
  wrapRegistrar("registerTool");

  return server;
}

/**
 * Wrap an MCP server's tool registrar so read-only instances expose only the
 * reviewed allowlist. The Shopify token should still be least-privilege; this
 * policy is an additional server-side capability boundary.
 */
export function applyToolAccessPolicy<T extends ToolServer>(
  server: T,
  readOnly: boolean,
): T {
  if (!readOnly) {
    return server;
  }

  const allowlist = new Set(
    [...READ_ONLY_TOOL_NAMES].filter((name) => !WRITE_TOOL_NAMES.has(name)),
  );

  return wrapRegistrarWithAllowlist(server, allowlist);
}

/**
 * Wrap an MCP server's tool registrar for P0 draft-only deployments: the
 * read-only allowlist plus "create-product". Everything else — including
 * update-product, delete-product, bulk-* mutations, and draft/live orders —
 * is unreachable, regardless of how the caller invokes it.
 */
export function applyDraftOnlyToolAccessPolicy<T extends ToolServer>(
  server: T,
  enabled: boolean,
): T {
  if (!enabled) {
    return server;
  }

  return wrapRegistrarWithAllowlist(server, P0_DRAFT_ONLY_TOOL_NAMES);
}
