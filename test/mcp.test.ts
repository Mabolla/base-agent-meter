import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { handleMeterMcpRequest } from "../src/mcp.js";
import { verifyBaseSettlement } from "../src/proof.js";

describe("Base Agent Meter MCP server", () => {
  it("publishes read-only assurance tools and verifies a supplied transaction", async () => {
    const verifySettlement = vi.fn(async (_rpcUrl: string, input: Parameters<typeof verifyBaseSettlement>[1]) => ({
      network: "eip155:8453",
      transactionHash: input.transactionHash,
      settlementVerified: true,
      builderAttribution: { declared: "bc_h2oqnbbh", verified: true },
    })) as unknown as typeof verifyBaseSettlement;
    const app = express();
    app.use(express.json());
    app.all("/mcp", (req, res) => {
      void handleMeterMcpRequest(req, res, { rpcUrl: "https://rpc.example", verifySettlement });
    });
    let listener: Server | undefined;
    listener = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => listener?.once("listening", resolve));
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("HTTP test server did not bind to a TCP port");
    const client = new Client({ name: "meter-test", version: "1.0.0" });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
      const listed = await client.listTools();
      expect(listed.tools.map(tool => tool.name)).toEqual(["check_x402_endpoint", "verify_base_settlement"]);
      expect(listed.tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);

      const unsupportedMethod = await client.callTool({ name: "check_x402_endpoint", arguments: { url: "https://seller.example/paid", method: "POST" } });
      expect(unsupportedMethod.isError).toBe(true);
      const privateTarget = await client.callTool({ name: "check_x402_endpoint", arguments: { url: "http://127.0.0.1/" } });
      expect(privateTarget.isError).toBe(true);
      for (const method of ["GET", "DELETE"]) {
        const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, { method });
        expect(response.status).toBe(405);
        expect(response.headers.get("allow")).toBe("POST");
      }

      const result = await client.callTool({
        name: "verify_base_settlement",
        arguments: {
          transactionHash: `0x${"1".repeat(64)}`,
          expectedPayTo: "0x0000000000000000000000000000000000000001",
          expectedAmount: "10000",
          declaredBuilderCode: "seller_code",
        },
      });

      expect(result.isError).not.toBe(true);
      const resultContent = result.content as Array<{ type: string; text?: string }>;
      expect(JSON.parse(resultContent[0].text ?? "{}").proof.settlementVerified).toBe(true);
      expect(verifySettlement).toHaveBeenCalledOnce();
      expect(verifySettlement).toHaveBeenCalledWith("https://rpc.example", expect.objectContaining({ declaredBuilderCode: "seller_code" }));
      await client.callTool({ name: "verify_base_settlement", arguments: { transactionHash: `0x${"1".repeat(64)}`, expectedPayTo: "0x0000000000000000000000000000000000000001", expectedAmount: "10000" } });
      expect(vi.mocked(verifySettlement).mock.calls[1][1].declaredBuilderCode).toBeUndefined();
    } finally {
      await client.close();
      await new Promise<void>((resolve, reject) => listener?.close(error => error ? reject(error) : resolve()));
    }
  });
});
