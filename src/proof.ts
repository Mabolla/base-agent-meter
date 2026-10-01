import { decodeEventLog, erc20Abi, getAddress, type Hex } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { parseBuilderCodeSuffixFromCalldata } from "@x402/extensions/builder-code";
import { Attribution } from "ox/erc8021";
import { BASE_USDC } from "./assurance.js";

export function inspectBuilderAttribution(calldata: Hex, declaredBuilderCode?: string) {
  const x402 = parseBuilderCodeSuffixFromCalldata(calldata);
  if (x402) {
    return { declared: declaredBuilderCode ?? null, observed: x402, format: "erc8021-schema-2" as const, verified: Boolean(declaredBuilderCode && x402.a === declaredBuilderCode) };
  }
  let legacy: ReturnType<typeof Attribution.fromData>;
  try { legacy = Attribution.fromData(calldata); } catch { legacy = undefined; }
  if (legacy?.id === 0) {
    return { declared: declaredBuilderCode ?? null, observed: legacy, format: "erc8021-schema-0" as const, verified: Boolean(declaredBuilderCode && legacy.codes.includes(declaredBuilderCode)) };
  }
  // Schema 1 uses a custom registry. A matching string alone cannot establish its identity.
  return { declared: declaredBuilderCode ?? null, observed: legacy ?? null, format: legacy ? `erc8021-schema-${legacy.id}` : null, verified: false };
}

export async function verifyBaseSettlement(
  rpcUrl: string,
  input: { transactionHash: Hex; expectedPayer?: string; expectedPayTo: string; expectedAmount: string; declaredBuilderCode?: string },
) {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 12_000 }) });
  // Facilitators can return settlement success before a public RPC has indexed the transaction.
  const receipt = await client.waitForTransactionReceipt({
    hash: input.transactionHash,
    confirmations: 1,
    pollingInterval: 1_000,
    timeout: 60_000,
  });
  const transaction = await client.getTransaction({ hash: input.transactionHash });
  const transfers = receipt.logs
    .filter(log => getAddress(log.address) === BASE_USDC)
    .flatMap(log => {
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: log.data, topics: log.topics });
        return [{ from: getAddress(decoded.args.from), to: getAddress(decoded.args.to), amount: decoded.args.value.toString() }];
      } catch { return []; }
    });
  const expectedTransfer = transfers.find(transfer =>
    transfer.to === getAddress(input.expectedPayTo)
    && transfer.amount === input.expectedAmount
    && (!input.expectedPayer || transfer.from === getAddress(input.expectedPayer)),
  );
  const builderAttribution = inspectBuilderAttribution(transaction.input, input.declaredBuilderCode);
  const settlementVerified = receipt.status === "success" && Boolean(expectedTransfer);

  return {
    network: "eip155:8453",
    transactionHash: input.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    transactionStatus: receipt.status,
    settlementVerified,
    usdc: {
      contract: BASE_USDC,
      expected: { payer: input.expectedPayer ?? null, payTo: getAddress(input.expectedPayTo), amount: input.expectedAmount },
      verified: Boolean(expectedTransfer),
      matchingTransfer: expectedTransfer ?? null,
      observedTransfers: transfers,
    },
    builderAttribution,
  };
}
