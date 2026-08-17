import { afterEach, describe, expect, it } from "vitest";
import { BASE_MAINNET, DEFAULT_BUILDER_CODE, loadConfig } from "../src/config.js";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });

describe("loadConfig", () => {
  it("runs assurance checks without seller credentials", () => {
    delete process.env.PAY_TO;
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
    delete process.env.X402_NETWORK;
    const config = loadConfig();
    expect(config.network).toBe(BASE_MAINNET);
    expect(config.facilitatorUrl).toBe("https://api.cdp.coinbase.com/platform/v2/x402");
    expect(config.builderCode).toBe(DEFAULT_BUILDER_CODE);
    expect(config.payTo).toBeUndefined();
    expect(config.cdpConfigured).toBe(false);
  });

  it("rejects accidental non-mainnet configuration", () => {
    process.env.X402_NETWORK = "eip155:84532";
    expect(() => loadConfig()).toThrow(/only accepts eip155:8453/);
  });

  it("rejects an invalid receiver address", () => {
    process.env.PAY_TO = "not-an-address";
    expect(() => loadConfig()).toThrow(/valid EVM address/);
  });

  it("rejects an invalid ERC-8021 builder code", () => {
    process.env.BUILDER_CODE = "Base Agent Meter";
    expect(() => loadConfig()).toThrow(/BUILDER_CODE/);
  });

  it("detects complete CDP seller-fixture configuration", () => {
    process.env.PAY_TO = "0x0000000000000000000000000000000000000001";
    process.env.CDP_API_KEY_ID = "id";
    process.env.CDP_API_KEY_SECRET = "secret";
    expect(loadConfig().cdpConfigured).toBe(true);
  });
});
