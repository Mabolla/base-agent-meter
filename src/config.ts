import "dotenv/config";
import { getAddress, isAddress } from "viem";

export const BASE_MAINNET = "eip155:8453" as const;
export const DEFAULT_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
export const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";

function requirePayTo(): `0x${string}` {
  const value = process.env.PAY_TO;
  if (!value || !isAddress(value)) {
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

export function loadConfig() {
  const network = process.env.X402_NETWORK ?? BASE_MAINNET;
  if (network !== BASE_MAINNET) {
    throw new Error(`Base Agent Meter production server only accepts ${BASE_MAINNET}`);
  }

  return {
    payTo: requirePayTo(),
    network: BASE_MAINNET,
    price: readPrice(),
    facilitatorUrl: process.env.FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    rpcUrl: process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL,
    port: Number(process.env.PORT ?? "4021"),
  } as const;
}
