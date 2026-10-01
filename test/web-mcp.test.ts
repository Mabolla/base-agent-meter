import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it, vi } from "vitest";
import { handleMeterWebRequest } from "../src/web-mcp.js";
import type { verifyBaseSettlement } from "../src/proof.js";

describe("Web MCP adapter", () => {
  it("serves the same read-only tools and delegates proof inputs", async () => {
    const verifySettlement = vi.fn(async () => ({ settlementVerified: true })) as unknown as typeof verifyBaseSettlement;
    const dependencies = { rpcUrl: "https://rpc.example", verifySettlement };
    const client = new Client({ name: "web-adapter-test", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL("https://meter.example/mcp"), {
      fetch: async (input, init) => handleMeterWebRequest(new Request(input as RequestInfo, init), dependencies),
    }));
    try {
      const listed = await client.listTools();
      expect(listed.tools.map(tool => tool.name)).toEqual(["check_x402_endpoint", "verify_base_settlement"]);
      expect(listed.tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);
      const result = await client.callTool({ name: "verify_base_settlement", arguments: { transactionHash: `0x${"1".repeat(64)}`, expectedPayTo: "0x1111111111111111111111111111111111111111", expectedAmount: "1000", declaredBuilderCode: "seller_code" } });
      expect(result.isError).not.toBe(true);
      expect(verifySettlement).toHaveBeenCalledWith("https://rpc.example", expect.objectContaining({ declaredBuilderCode: "seller_code" }));
      const rejected = await client.callTool({ name: "check_x402_endpoint", arguments: { url: "http://127.0.0.1/" } });
      expect(rejected.isError).toBe(true);
    } finally { await client.close(); }
  });

  it("rejects unsupported methods and foreign browser origins", async () => {
    const dependencies = { rpcUrl: "https://rpc.example" };
    const get = await handleMeterWebRequest(new Request("https://meter.example/mcp"), dependencies);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    const crossOrigin = await handleMeterWebRequest(new Request("https://meter.example/mcp", { method: "POST", headers: { Origin: "https://other.example" } }), dependencies);
    expect(crossOrigin.status).toBe(403);
  });

  it("bounds request bodies before dispatching tools", async () => {
    const response = await handleMeterWebRequest(new Request("https://meter.example/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: "x".repeat(65537) }), { rpcUrl: "https://rpc.example" });
    expect(response.status).toBe(413);
  });
});
