import "dotenv/config";
import { getAddress, isAddress } from "viem";

export const BASE_MAINNET = "eip155:8453" as const;
export const DEFAULT_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
export const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
export const DEFAULT_BUILDER_CODE = "bc_h2oqnbbh";

function readPayTo(): `0x${string}` | undefined {
  const value = process.env.PAY_TO;
  if (!value) return undefined;
  if (!isAddress(value)) {
    throw new Error("PAY_TO must be a valid EVM address");
  }
  return getAddress(value);
}

function readPrice(): string {
  const raw = process.env.X402_PRICE_USD ?? "0.001";
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error("X402_PRICE_USD must be greater than 0 and at most 1");
  }
  return `$${raw}`;
}

function readBuilderCode(): string {
  const value = process.env.BUILDER_CODE ?? DEFAULT_BUILDER_CODE;
  if (!/^[a-z0-9_]{1,32}$/.test(value)) {
    throw new Error("BUILDER_CODE must be 1-32 lowercase alphanumeric or underscore characters");
  }
  return value;
}

export function loadConfig() {
  const network = process.env.X402_NETWORK ?? BASE_MAINNET;
  if (network !== BASE_MAINNET) {
    throw new Error(`Base Agent Meter production server only accepts ${BASE_MAINNET}`);
  }

  return {
    payTo: readPayTo(),
    network: BASE_MAINNET,
    price: readPrice(),
    facilitatorUrl: process.env.FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    rpcUrl: process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL,
    builderCode: readBuilderCode(),
    cdpConfigured: Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET),
    port: Number(process.env.PORT ?? "4021"),
  } as const;
}
