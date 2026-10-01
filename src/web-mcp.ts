import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMeterMcpServer, type McpDependencies } from "./mcp.js";

export function meterMethodNotAllowed() {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Method not allowed" } }, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}

/** Web Request/Response adapter for Node runtimes such as Next.js route handlers. */
export async function handleMeterWebRequest(request: Request, dependencies: McpDependencies): Promise<Response> {
  if (request.method !== "POST") return meterMethodNotAllowed();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Origin not allowed" } }, { status: 403 });
  }
  const server = createMeterMcpServer(dependencies);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 64 * 1024,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "MCP request failed" } }, { status: 500 });
  } finally {
    await server.close().catch(() => undefined);
  }
}
