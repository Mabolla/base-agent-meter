import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Run from this repository after its dependencies are available.
// Usage: node examples/agent-client.mjs <MCP URL> <public seller URL>
const [mcpUrl, sellerUrl] = process.argv.slice(2);
if (!mcpUrl || !sellerUrl) {
  console.error("Usage: node examples/agent-client.mjs <MCP URL> <public seller URL>");
  process.exit(2);
}

const client = new Client({ name: "base-agent-meter-example", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
  const result = await client.callTool({ name: "check_x402_endpoint", arguments: { url: sellerUrl } });
  console.log(JSON.stringify(result, null, 2));
  if (result.isError) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "MCP request failed");
  process.exitCode = 1;
} finally {
  await client.close();
}
