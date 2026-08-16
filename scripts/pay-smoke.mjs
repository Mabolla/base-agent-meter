import "dotenv/config";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const target = process.env.API_URL ?? "https://base-agent-meter-production.up.railway.app/api/base-snapshot";
const rawPrivateKey = process.env.EVM_PRIVATE_KEY?.trim();

if (!rawPrivateKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(rawPrivateKey)) {
  console.error("EVM_PRIVATE_KEY must be a 32-byte hex private key, with or without the 0x prefix. Use a low-balance dedicated test wallet; never commit it.");
  process.exit(1);
}

const privateKey = (rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`);
const account = privateKeyToAccount(privateKey);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
});

console.log(`payer=${account.address}`);
console.log(`target=${target}`);

const response = await paidFetch(target, { method: "GET" });
const bodyText = await response.text();

console.log(`status=${response.status}`);

const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
if (paymentResponse) {
  try {
    console.log("paymentResponse=", JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
  } catch {
    console.log("paymentResponseRaw=", paymentResponse);
  }
}

try {
  console.log("body=", JSON.stringify(JSON.parse(bodyText), null, 2));
} catch {
  console.log("body=", bodyText);
}

if (!response.ok) process.exit(2);
