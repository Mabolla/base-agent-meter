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
  builderCode: string;
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
      description: "Read a public HTTP endpoint and report whether its x402 v2 challenge advertises Base Mainnet USDC, stable payment details, Bazaar metadata, and Builder Code attribution. No payment is made. Private, loopback, link-local, and carrier-grade NAT destinations are rejected.",
      inputSchema: {
        url: z.string().url(),
        method: z.enum(["GET", "POST"]).optional(),
        body: z.unknown().optional(),
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
      description: "Read a Base Mainnet transaction and verify its successful receipt and exact USDC transfer to the expected recipient, amount, and optional payer. Also reports whether the configured Builder Code appears in the transaction calldata. This does not submit or modify transactions.",
      inputSchema: {
        transactionHash: z.string().refine(isHash, "must be a 32-byte transaction hash"),
        expectedPayTo: z.string().refine(isAddress, "must be a valid EVM address"),
        expectedAmount: z.string().regex(/^[1-9]\d*$/, "must be a positive atomic-unit amount"),
        expectedPayer: z.string().refine(isAddress, "must be a valid EVM address").optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => {
      try {
        return jsonResult({
          verifiedAt: new Date().toISOString(),
          proof: await verifySettlement(dependencies.rpcUrl, {
            ...input,
            declaredBuilderCode: dependencies.builderCode,
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
  const server = createMeterMcpServer(dependencies);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("mcp_request_failed", error);
    if (!res.headersSent) res.statusCode = 500;
    if (!res.writableEnded) res.end(JSON.stringify({ error: "mcp_request_failed" }));
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}
