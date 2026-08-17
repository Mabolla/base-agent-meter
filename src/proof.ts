import { decodeEventLog, erc20Abi, getAddress, type Hex } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { parseBuilderCodeSuffixFromCalldata } from "@x402/extensions/builder-code";
import { BASE_USDC } from "./assurance.js";

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
  const attribution = parseBuilderCodeSuffixFromCalldata(transaction.input);
  const builderVerified = Boolean(input.declaredBuilderCode && attribution?.a === input.declaredBuilderCode);
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
    builderAttribution: {
      declared: input.declaredBuilderCode ?? null,
      observed: attribution ?? null,
      verified: builderVerified,
    },
  };
}
