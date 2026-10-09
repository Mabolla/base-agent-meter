import express from "express";
import { describe, expect, it } from "vitest";
import { handleMeterMcpRequest } from "../src/mcp.ts";
import { evaluateResult, runAssurance } from "../examples/agent-assurance.mjs";

const input = { transactionHash: `0x${"1".repeat(64)}`, expectedPayTo: "0x0000000000000000000000000000000000000001", expectedAmount: "10000", declaredBuilderCode: "seller_code" };
const evidence = (settled, attributed) => ({ proof: { network: "eip155:8453", transactionHash: input.transactionHash, settlementVerified: settled, builderAttribution: { verified: attributed } } });
const envelope = value => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

describe("agent assurance evidence", () => {
  it("does not mistake successful transport for successful payment or attribution", () => {
    expect(evaluateResult("verify_base_settlement", envelope(evidence(false, true)), input).status).toBe("FAIL");
    expect(evaluateResult("verify_base_settlement", envelope(evidence(true, false)), input).status).toBe("FAIL");
    expect(evaluateResult("verify_base_settlement", envelope(evidence(true, true)), input).status).toBe("PASS");
    const { declaredBuilderCode, ...withoutCode } = input;
    expect(evaluateResult("verify_base_settlement", envelope(evidence(true, false)), withoutCode).status).toBe("PASS");
  });
  it("rejects malformed and unrelated evidence", () => {
    expect(evaluateResult("verify_base_settlement", envelope({}), input).status).toBe("ERROR");
    const wrong = evidence(true, true); wrong.proof.transactionHash = `0x${"2".repeat(64)}`;
    expect(evaluateResult("verify_base_settlement", envelope(wrong), input).status).toBe("ERROR");
    expect(evaluateResult("check_x402_endpoint", { isError: true, content: [] }, {}).status).toBe("ERROR");
    expect(evaluateResult("check_x402_endpoint", envelope({ status: "WARN" }), {}).status).toBe("WARN");
  });
  it("discovers and invokes the actual HTTP MCP path, preserving failed proof", async () => {
    const app = express(); app.use(express.json());
    app.all("/mcp", (req, res) => void handleMeterMcpRequest(req, res, {
      rpcUrl: "https://rpc.example", verifySettlement: async () => evidence(false, false).proof,
    }));
    const listener = app.listen(0, "127.0.0.1");
    await new Promise(resolve => listener.once("listening", resolve));
    try {
      const url = `http://127.0.0.1:${listener.address().port}/mcp`;
      const report = await runAssurance(url, "verify_base_settlement", input);
      expect(report.status).toBe("FAIL");
      expect(report.evidence.proof.settlementVerified).toBe(false);
      await expect(runAssurance(url, "issue_base_receipt", input)).rejects.toThrow("Only read-only");
    } finally { await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())); }
  });
});
