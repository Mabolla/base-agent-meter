import { describe, expect, it } from "vitest";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { checkX402Endpoint, CheckInputError, BASE_USDC } from "../src/assurance.js";

const challenge: PaymentRequired = {
  x402Version: 2,
  resource: { url: "https://seller.example/paid", description: "Paid resource", mimeType: "application/json" },
  accepts: [{
    scheme: "exact",
    network: "eip155:8453",
    asset: BASE_USDC,
    amount: "1000",
    payTo: "0x0000000000000000000000000000000000000001",
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2" },
  }],
  extensions: {
    bazaar: { info: { input: { type: "http", method: "GET" } }, schema: {} },
    "builder-code": { info: { a: "base_agent_meter" }, schema: {} },
  },
};

const publicDns = async () => ["203.0.113.10"];

describe("checkX402Endpoint", () => {
  it("passes valid Base USDC negotiation and distinguishes declared attribution", async () => {
    const report = await checkX402Endpoint({
      url: "https://seller.example/paid",
      expectations: { payTo: "0x0000000000000000000000000000000000000001", amount: "1000" },
    }, {
      resolveHost: publicDns,
      fetchImpl: async () => new Response(JSON.stringify(challenge), {
        status: 402,
        headers: { "content-type": "application/json", "payment-required": encodePaymentRequiredHeader(challenge) },
      }),
    });
    expect(report.status).toBe("PASS");
    expect(report.payment?.asset).toBe(BASE_USDC);
    expect(report.discovery).toMatchObject({ bazaar: "present", builderAttribution: "declared", builderCode: "base_agent_meter" });
    expect(report.findings.find(finding => finding.code === "builder_code_declared")?.message).toMatch(/not yet onchain-verified/);
  });

  it("fails closed on recipient drift", async () => {
    const report = await checkX402Endpoint({ url: "https://seller.example/paid", expectations: { payTo: "0x0000000000000000000000000000000000000002" } }, {
      resolveHost: publicDns,
      fetchImpl: async () => new Response(JSON.stringify(challenge), { status: 402, headers: { "payment-required": encodePaymentRequiredHeader(challenge) } }),
    });
    expect(report.status).toBe("FAIL");
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "payTo_drift", level: "fail" }));
  });

  it("warns when discovery extensions are missing", async () => {
    const withoutExtensions = { ...challenge, extensions: undefined };
    const report = await checkX402Endpoint({ url: "https://seller.example/paid" }, {
      resolveHost: publicDns,
      fetchImpl: async () => new Response(JSON.stringify(withoutExtensions), { status: 402, headers: { "payment-required": encodePaymentRequiredHeader(withoutExtensions) } }),
    });
    expect(report.status).toBe("WARN");
    expect(report.discovery).toMatchObject({ bazaar: "missing", builderAttribution: "not_declared" });
  });

  it("rejects private and loopback targets", async () => {
    await expect(checkX402Endpoint({ url: "http://internal.example/" }, { resolveHost: async () => ["127.0.0.1"] })).rejects.toBeInstanceOf(CheckInputError);
  });

  it("rejects a missing request body as invalid input", async () => {
    await expect(checkX402Endpoint(undefined as unknown as { url: string })).rejects.toBeInstanceOf(CheckInputError);
  });
});
