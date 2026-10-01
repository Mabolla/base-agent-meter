import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAddress, isHash } from "viem";
import { z } from "zod";
import { checkX402Endpoint, type CheckRequest } from "./assurance.js";
import { verifyBaseSettlement } from "./proof.js";

interface McpDependencies {
  checkEndpoint?: typeof checkX402Endpoint;
  verifySettlement?: typeof verifyBaseSettlement;
  rpcUrl: string;
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function errorResult(error: unknown) {
  return {
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "The requested check failed." }],
    isError: true,
  };
}

export function createMeterMcpServer(dependencies: McpDependencies) {
  const server = new McpServer(
    { name: "base-agent-meter", version: "0.2.0" },
    { instructions: "Read-only Base x402 assurance tools. These tools never sign, submit, or pay for transactions." },
  );
  const checkEndpoint = dependencies.checkEndpoint ?? checkX402Endpoint;
  const verifySettlement = dependencies.verifySettlement ?? verifyBaseSettlement;

  server.registerTool(
    "check_x402_endpoint",
    {
      title: "Check an x402 endpoint",
      description: "Send an unpaid GET to a public endpoint and report its x402 v2 Base Mainnet USDC challenge, payment details, Bazaar metadata, and declared Builder Code. Only GET is supported by this read-only tool; use the CLI or HTTP API for an explicitly requested POST check.",
      inputSchema: {
        url: z.string().url(),
        method: z.literal("GET").optional(),
        expectations: z.object({
          network: z.string().optional(),
          asset: z.string().optional(),
          payTo: z.string().optional(),
          amount: z.string().optional(),
        }).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        return jsonResult(await checkEndpoint(input as CheckRequest));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "verify_base_settlement",
    {
      title: "Verify a Base settlement",
      description: "Read a Base Mainnet transaction and verify its successful receipt and exact USDC transfer to the expected recipient, amount, and optional payer. Reports observed attribution and compares it with declaredBuilderCode only when supplied. This does not submit or modify transactions.",
      inputSchema: {
        transactionHash: z.string().refine(isHash, "must be a 32-byte transaction hash"),
        expectedPayTo: z.string().refine(isAddress, "must be a valid EVM address"),
        expectedAmount: z.string().regex(/^[1-9]\d*$/, "must be a positive atomic-unit amount"),
        expectedPayer: z.string().refine(isAddress, "must be a valid EVM address").optional(),
        declaredBuilderCode: z.string().regex(/^[a-z0-9_]{1,32}$/).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => {
      try {
        return jsonResult({
          verifiedAt: new Date().toISOString(),
          proof: await verifySettlement(dependencies.rpcUrl, {
            ...input,
          }),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

export async function handleMeterMcpRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  dependencies: McpDependencies,
) {
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST", "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Method not allowed" } }));
    return;
  }
  const server = createMeterMcpServer(dependencies);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("mcp_request_failed", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "MCP request failed" } }));
    } else if (!res.writableEnded) res.end();
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}
