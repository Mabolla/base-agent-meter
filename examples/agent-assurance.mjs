import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const allowedTools = new Set(["check_x402_endpoint", "verify_base_settlement"]);

// A successful MCP envelope is not evidence of a successful settlement.
export function evaluateResult(tool, result, input) {
  if (result.isError) return { status: "ERROR", evidence: result.content };
  let evidence;
  try {
    evidence = result.structuredContent ?? JSON.parse(result.content.find(item => item.type === "text")?.text ?? "null");
  } catch { return { status: "ERROR", reason: "Unparseable tool evidence" }; }
  if (tool === "check_x402_endpoint") {
    if (!["PASS", "WARN", "FAIL"].includes(evidence?.status)) return { status: "ERROR", reason: "Missing endpoint verdict", evidence };
    return { status: evidence.status, evidence };
  }
  const proof = evidence?.proof;
  if (proof?.network !== "eip155:8453" || proof?.transactionHash?.toLowerCase() !== input.transactionHash?.toLowerCase()
    || typeof proof?.settlementVerified !== "boolean") {
    return { status: "ERROR", reason: "Missing or mismatched settlement evidence", evidence };
  }
  const attributionRequired = input.declaredBuilderCode !== undefined;
  return {
    status: proof.settlementVerified && (!attributionRequired || proof.builderAttribution?.verified === true) ? "PASS" : "FAIL",
    attributionRequired,
    evidence,
  };
}

export async function runAssurance(mcpUrl, tool, input) {
  if (!allowedTools.has(tool)) throw new Error("Only read-only Meter tools are supported");
  const endpoint = new URL(mcpUrl);
  if (endpoint.username || endpoint.password || !["http:", "https:"].includes(endpoint.protocol)) throw new Error("Invalid MCP URL");
  const client = new Client({ name: "base-agent-meter-assurance", version: "1.0.0" });
  const startedAt = Date.now();
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint));
    const listed = await client.listTools();
    const discovered = listed.tools.find(item => item.name === tool);
    if (!discovered || discovered.annotations?.readOnlyHint !== true) throw new Error("Requested read-only tool is unavailable");
    const result = await client.callTool({ name: tool, arguments: input }, undefined, { timeout: 90_000 });
    return { checkedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, mcpUrl: endpoint.href, tool, input, ...evaluateResult(tool, result, input) };
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mcpUrl, tool, inputFile] = process.argv.slice(2);
  if (!mcpUrl || !tool || !inputFile) {
    console.error("Usage: node examples/agent-assurance.mjs <MCP URL> <check_x402_endpoint|verify_base_settlement> <input.json>");
    process.exitCode = 2;
  } else {
    try {
      const input = JSON.parse(await readFile(inputFile, "utf8"));
      const report = await runAssurance(mcpUrl, tool, input);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = ["PASS", "WARN"].includes(report.status) ? 0 : 1;
    } catch (error) {
      console.log(JSON.stringify({ status: "ERROR", message: error instanceof Error ? error.message : "Assurance failed" }));
      process.exitCode = 1;
    }
  }
}
