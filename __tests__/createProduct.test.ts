import { createProduct } from "../src/tools/createProduct.js";

describe("create-product", () => {
  it("includes the default Title product option for a simple product variant", async () => {
    const product = {
      id: "gid://shopify/Product/123",
      title: "Keihin Screw",
      handle: "keihin-screw",
      descriptionHtml: "",
      vendor: "Keihin",
      productType: "Parts",
      category: null,
      status: "DRAFT",
      tags: ["hermes", "needs-review"],
      variants: {
        edges: [
          {
            node: {
              id: "gid://shopify/ProductVariant/456",
              title: "Default Title",
              price: "10.00",
              compareAtPrice: null,
              sku: "0136-806-1100",
              barcode: null,
            },
          },
        ],
      },
      images: { edges: [] },
    };
    const request = jest.fn().mockResolvedValue({
      productSet: { product, userErrors: [] },
    });
    createProduct.initialize({ request } as any);

    await createProduct.execute({
      title: "Keihin Screw",
      status: "DRAFT",
      price: "10.00",
      sku: "0136-806-1100",
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]).toEqual({
      synchronous: true,
      input: {
        title: "Keihin Screw",
        status: "DRAFT",
        productOptions: [
          { name: "Title", values: [{ name: "Default Title" }] },
        ],
        variants: [
          {
            optionValues: [{ optionName: "Title", name: "Default Title" }],
            price: "10.00",
            sku: "0136-806-1100",
          },
        ],
      },
    });
  });
});


describe("create-product P0 draft-only enforcement", () => {
  const originalEnv = process.env.SHOPIFY_MCP_TOOL_ACCESS_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SHOPIFY_MCP_TOOL_ACCESS_MODE;
    } else {
      process.env.SHOPIFY_MCP_TOOL_ACCESS_MODE = originalEnv;
    }
  });

  it("forces status to DRAFT even when caller requests ACTIVE, in p0-draft-only mode", async () => {
    process.env.SHOPIFY_MCP_TOOL_ACCESS_MODE = "p0-draft-only";

    const product = {
      id: "gid://shopify/Product/999",
      title: "Sneaky Live Product",
      handle: "sneaky-live-product",
      descriptionHtml: "",
      vendor: null,
      productType: null,
      category: null,
      status: "DRAFT",
      tags: [],
      variants: { edges: [] },
      images: { edges: [] },
    };
    const request = jest.fn().mockResolvedValue({
      productSet: { product, userErrors: [] },
    });
    createProduct.initialize({ request } as any);

    await createProduct.execute({
      title: "Sneaky Live Product",
      status: "ACTIVE",
      price: "10.00",
    });

    expect(request.mock.calls[0][1].input.status).toBe("DRAFT");
  });

  it("leaves status untouched when not in p0-draft-only mode", async () => {
    delete process.env.SHOPIFY_MCP_TOOL_ACCESS_MODE;

    const product = {
      id: "gid://shopify/Product/1000",
      title: "Normal Product",
      handle: "normal-product",
      descriptionHtml: "",
      vendor: null,
      productType: null,
      category: null,
      status: "ACTIVE",
      tags: [],
      variants: { edges: [] },
      images: { edges: [] },
    };
    const request = jest.fn().mockResolvedValue({
      productSet: { product, userErrors: [] },
    });
    createProduct.initialize({ request } as any);

    await createProduct.execute({
      title: "Normal Product",
      status: "ACTIVE",
      price: "10.00",
    });

    expect(request.mock.calls[0][1].input.status).toBe("ACTIVE");
  });
});
