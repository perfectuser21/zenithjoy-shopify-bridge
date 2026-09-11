import {
  READ_ONLY_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  P0_DRAFT_ONLY_TOOL_NAMES,
  applyToolAccessPolicy,
  applyDraftOnlyToolAccessPolicy,
  parseReadOnlyMode,
  parseDraftOnlyMode,
} from "../src/toolAccess.js";

describe("Shopify MCP read-only mode", () => {
  it.each([
    [true, true],
    ["true", true],
    ["1", true],
    ["yes", true],
    ["on", true],
    [false, false],
    [undefined, false],
    ["false", false],
    ["0", false],
  ])("parses %p as %p", (value, expected) => {
    expect(parseReadOnlyMode(value)).toBe(expected);
  });

  it("registers allowlisted read tools and suppresses write tools", () => {
    const register = jest.fn((name: string) => `registered:${name}`);
    const server = { tool: register };

    applyToolAccessPolicy(server, true);

    expect(server.tool("products")).toBe("registered:products");
    expect(server.tool("list-metaobjects")).toBe(
      "registered:list-metaobjects",
    );
    expect(server.tool("update-product")).toBeUndefined();
    expect(server.tool("update-metaobject")).toBeUndefined();
    expect(server.tool("update-metaobject-definition")).toBeUndefined();
    expect(register.mock.calls.map(([name]) => name)).toEqual([
      "products",
      "list-metaobjects",
    ]);
  });

  it("blocks unknown future tools by default in read-only mode", () => {
    const register = jest.fn((name: string) => name);
    const server = { tool: register };

    applyToolAccessPolicy(server, true);

    expect(server.tool("future-tool-not-yet-classified")).toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });

  it("blocks unknown future tools registered through the modern SDK API", () => {
    const legacyRegister = jest.fn((name: string) => name);
    const modernRegister = jest.fn((name: string) => name);
    const server = {
      tool: legacyRegister,
      registerTool: modernRegister,
    };

    applyToolAccessPolicy(server, true);

    expect(server.registerTool("products")).toBe("products");
    expect(server.registerTool("future-tool-not-yet-classified")).toBeUndefined();
    expect(modernRegister.mock.calls.map(([name]) => name)).toEqual(["products"]);
  });

  it("does not alter tool registration in normal mode", () => {
    const register = jest.fn((name: string) => `registered:${name}`);
    const server = { tool: register };

    applyToolAccessPolicy(server, false);

    expect(server.tool("update-product")).toBe("registered:update-product");
    expect(register).toHaveBeenCalledWith("update-product");
  });

  it("keeps mixed read/write tools out of the read-only allowlist", () => {
    expect(WRITE_TOOL_NAMES.has("create-metafield-definition")).toBe(true);
    expect(READ_ONLY_TOOL_NAMES.has("create-metafield-definition")).toBe(false);
    expect(WRITE_TOOL_NAMES.has("update-metaobject-definition")).toBe(true);
    expect(WRITE_TOOL_NAMES.has("update-inventory-item-customs")).toBe(true);
    expect(READ_ONLY_TOOL_NAMES.has("update-inventory-item-customs")).toBe(false);
    expect(WRITE_TOOL_NAMES.has("update-inventory-item-shipping")).toBe(true);
    expect(READ_ONLY_TOOL_NAMES.has("update-inventory-item-shipping")).toBe(false);
    expect(READ_ONLY_TOOL_NAMES.has("manage-collection-products")).toBe(false);
    expect(READ_ONLY_TOOL_NAMES.has("create-file-upload-session")).toBe(false);
    expect(READ_ONLY_TOOL_NAMES.has("attach-file-to-product")).toBe(false);
    expect(READ_ONLY_TOOL_NAMES.has("start-bulk-export")).toBe(false);
  });
});

describe("Shopify MCP P0 draft-only mode", () => {
  it.each([
    [true, true],
    ["true", true],
    ["p0-draft-only", true],
    ["1", true],
    [false, false],
    [undefined, false],
    ["false", false],
    ["full", false],
  ])("parses %p as %p", (value, expected) => {
    expect(parseDraftOnlyMode(value)).toBe(expected);
  });

  it("allows create-product plus the full read-only allowlist, blocks everything else", () => {
    const register = jest.fn((name: string) => `registered:${name}`);
    const server = { tool: register };

    applyDraftOnlyToolAccessPolicy(server, true);

    expect(server.tool("create-product")).toBe("registered:create-product");
    expect(server.tool("products")).toBe("registered:products");
    expect(server.tool("get-inventory-levels")).toBe(
      "registered:get-inventory-levels",
    );

    expect(server.tool("update-product")).toBeUndefined();
    expect(server.tool("delete-product")).toBeUndefined();
    expect(server.tool("bulk-delete-products")).toBeUndefined();
    expect(server.tool("bulk-update-products")).toBeUndefined();
    expect(server.tool("create-draft-order")).toBeUndefined();
    expect(server.tool("complete-draft-order")).toBeUndefined();
  });

  it("blocks unknown future tools by default in draft-only mode", () => {
    const register = jest.fn((name: string) => name);
    const server = { tool: register };

    applyDraftOnlyToolAccessPolicy(server, true);

    expect(server.tool("future-tool-not-yet-classified")).toBeUndefined();
  });

  it("does not alter tool registration when disabled", () => {
    const register = jest.fn((name: string) => `registered:${name}`);
    const server = { tool: register };

    applyDraftOnlyToolAccessPolicy(server, false);

    expect(server.tool("delete-product")).toBe("registered:delete-product");
  });

  it("P0_DRAFT_ONLY_TOOL_NAMES is exactly the read-only allowlist plus create-product", () => {
    expect(P0_DRAFT_ONLY_TOOL_NAMES.has("create-product")).toBe(true);
    for (const name of READ_ONLY_TOOL_NAMES) {
      expect(P0_DRAFT_ONLY_TOOL_NAMES.has(name)).toBe(true);
    }
    expect(P0_DRAFT_ONLY_TOOL_NAMES.size).toBe(READ_ONLY_TOOL_NAMES.size + 1);
  });
});
