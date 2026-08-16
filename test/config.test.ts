import { afterEach, describe, expect, it } from "vitest";
import { BASE_MAINNET, loadConfig } from "../src/config.js";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadConfig", () => {
  it("defaults to Base Mainnet and the CDP facilitator", () => {
    process.env.PAY_TO = "0x0000000000000000000000000000000000000001";
    delete process.env.X402_NETWORK;
    delete process.env.FACILITATOR_URL;
    const config = loadConfig();
    expect(config.network).toBe(BASE_MAINNET);
    expect(config.facilitatorUrl).toBe("https://api.cdp.coinbase.com/platform/v2/x402");
  });

  it("rejects accidental non-mainnet configuration", () => {
    process.env.PAY_TO = "0x0000000000000000000000000000000000000001";
    process.env.X402_NETWORK = "eip155:84532";
    expect(() => loadConfig()).toThrow(/only accepts eip155:8453/);
  });

  it("rejects an invalid receiver address", () => {
    process.env.PAY_TO = "not-an-address";
    delete process.env.X402_NETWORK;
    expect(() => loadConfig()).toThrow(/valid EVM address/);
  });
});
