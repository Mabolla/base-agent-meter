import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { x402Client } from "@x402/core/client";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";
import { wrapFetchWithPayment } from "@x402/fetch";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkX402Endpoint, BASE_MAINNET, BASE_USDC } from "../dist/assurance.js";
import { verifyBaseSettlement } from "../dist/proof.js";

const args = process.argv.slice(2);
const target = args.find(arg => !arg.startsWith("--")) ?? process.env.CANARY_URL;
const execute = args.includes("--execute");
const method = (process.env.CANARY_METHOD ?? "GET").toUpperCase();
const body = process.env.CANARY_BODY;

if (!target) {
  console.error("Usage: npm run build && npm run canary -- <endpoint> [--execute]");
  process.exit(2);
}

const expectations = {
  network: BASE_MAINNET,
  asset: BASE_USDC,
  ...(process.env.CANARY_EXPECT_PAY_TO ? { payTo: process.env.CANARY_EXPECT_PAY_TO } : {}),
  ...(process.env.CANARY_EXPECT_AMOUNT ? { amount: process.env.CANARY_EXPECT_AMOUNT } : {}),
};
const negotiation = await checkX402Endpoint({
  url: target,
  method,
  ...(method === "POST" ? { body: body ? JSON.parse(body) : {} } : {}),
  expectations,
});

console.log(JSON.stringify({ mode: execute ? "execute_requested" : "dry_run", negotiation }, null, 2));
if (negotiation.status === "FAIL" || !negotiation.payment) process.exit(1);
if (!execute) {
  console.log("Dry run complete. No payment was prepared, signed, or broadcast.");
  process.exit(0);
}

if (process.env.CANARY_CONFIRM !== "PAY_BASE_MAINNET_CANARY") {
  throw new Error("Execution refused: set CANARY_CONFIRM=PAY_BASE_MAINNET_CANARY immediately before the approved payment.");
}
if (!process.env.CANARY_EXPECT_PAY_TO || !isAddress(process.env.CANARY_EXPECT_PAY_TO)) {
  throw new Error("Execution refused: CANARY_EXPECT_PAY_TO must pin the approved recipient.");
}
if (!process.env.CANARY_EXPECT_AMOUNT || !/^\d+$/.test(process.env.CANARY_EXPECT_AMOUNT)) {
  throw new Error("Execution refused: CANARY_EXPECT_AMOUNT must pin the approved USDC atomic amount.");
}
const rawPrivateKey = process.env.EVM_PRIVATE_KEY?.trim();
if (!rawPrivateKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(rawPrivateKey)) {
  throw new Error("Execution refused: EVM_PRIVATE_KEY must be a 32-byte private key for a dedicated low-balance canary wallet.");
}
if (getAddress(negotiation.payment.payTo) !== getAddress(process.env.CANARY_EXPECT_PAY_TO)
  || negotiation.payment.amount !== process.env.CANARY_EXPECT_AMOUNT
  || getAddress(negotiation.payment.asset) !== BASE_USDC
  || negotiation.payment.network !== BASE_MAINNET) {
  throw new Error("Execution refused: observed payment parameters differ from the approved pinned values.");
}

const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;
const account = privateKeyToAccount(privateKey);
const client = new x402Client().register(BASE_MAINNET, new ExactEvmScheme(account));
if (process.env.CANARY_CLIENT_BUILDER_CODE) {
  client.registerExtension(new BuilderCodeClientExtension(process.env.CANARY_CLIENT_BUILDER_CODE));
}
const paidFetch = wrapFetchWithPayment(fetch, client);
const request = {
  method,
  headers: method === "POST" ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" },
  ...(method === "POST" ? { body: body ?? "{}" } : {}),
};
const started = performance.now();
const response = await paidFetch(target, request);
const protectedBody = await response.text();
const latencyMs = Math.round(performance.now() - started);
const paymentResponseHeader = response.headers.get("payment-response");
if (!paymentResponseHeader) throw new Error("Paid response did not include PAYMENT-RESPONSE settlement evidence.");
const settlement = decodePaymentResponseHeader(paymentResponseHeader);
if (!response.ok || !settlement.success) throw new Error(`Paid canary failed: HTTP ${response.status}, settlement success=${settlement.success}.`);
console.log(JSON.stringify({
  settlementReceived: true,
  transactionHash: settlement.transaction,
  network: settlement.network,
  payer: settlement.payer ?? account.address,
  amount: settlement.amount ?? negotiation.payment.amount,
}, null, 2));

const proof = await verifyBaseSettlement(process.env.BASE_RPC_URL ?? "https://mainnet.base.org", {
  transactionHash: settlement.transaction,
  expectedPayer: account.address,
  expectedPayTo: negotiation.payment.payTo,
  expectedAmount: negotiation.payment.amount,
  declaredBuilderCode: negotiation.discovery.builderCode,
});
const report = {
  reportVersion: 1,
  timestamp: new Date().toISOString(),
  endpoint: target,
  result: response.ok && settlement.success && proof.settlementVerified ? "PASS" : "FAIL",
  expected: expectations,
  observed: negotiation.payment,
  payer: account.address,
  latencyMs,
  protectedResponse: {
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: Buffer.byteLength(protectedBody),
    sha256: createHash("sha256").update(protectedBody).digest("hex"),
  },
  settlement,
  proof,
  retry: {
    status: "not_tested",
    reason: "A second paid request can create another settlement unless the endpoint explicitly supports a verified idempotency workflow.",
  },
};
const reportPath = resolve(process.env.CANARY_REPORT_PATH ?? `artifacts/canary-${Date.now()}.json`);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ reportPath, report }, null, 2));
