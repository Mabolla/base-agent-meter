import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { createMeterMcpServer } from "../src/mcp.js";
import { verifyBaseSettlement } from "../src/proof.js";

describe("Base Agent Meter MCP server", () => {
  it("publishes read-only assurance tools and verifies a supplied transaction", async () => {
    const verifySettlement = vi.fn(async (_rpcUrl: string, input: Parameters<typeof verifyBaseSettlement>[1]) => ({
      network: "eip155:8453",
      transactionHash: input.transactionHash,
      settlementVerified: true,
      builderAttribution: { declared: "bc_h2oqnbbh", verified: true },
    })) as unknown as typeof verifyBaseSettlement;
    const server = createMeterMcpServer({ rpcUrl: "https://rpc.example", builderCode: "bc_h2oqnbbh", verifySettlement });
    const client = new Client({ name: "meter-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    expect(listed.tools.map(tool => tool.name)).toEqual(["check_x402_endpoint", "verify_base_settlement"]);
    expect(listed.tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);

    const result = await client.callTool({
      name: "verify_base_settlement",
      arguments: {
        transactionHash: `0x${"1".repeat(64)}`,
        expectedPayTo: "0x0000000000000000000000000000000000000001",
        expectedAmount: "10000",
      },
    });

    expect(result.isError).not.toBe(true);
    const resultContent = result.content as Array<{ type: string; text?: string }>;
    expect(JSON.parse(resultContent[0].text ?? "{}").proof.settlementVerified).toBe(true);
    expect(verifySettlement).toHaveBeenCalledOnce();
    await client.close();
    await server.close();
  });
});
