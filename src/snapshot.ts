import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export async function getBaseSnapshot(rpcUrl: string) {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const block = await client.getBlock({ blockTag: "latest" });

  return {
    network: "Base Mainnet",
    chainId: base.id,
    blockNumber: block.number.toString(),
    blockHash: block.hash,
    timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    gasLimit: block.gasLimit.toString(),
    gasUsed: block.gasUsed.toString(),
    baseFeePerGasWei: block.baseFeePerGas?.toString() ?? null,
  };
}
