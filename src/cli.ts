import { checkX402Endpoint, type CheckRequest } from "./assurance.js";

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const url = args.find(arg => !arg.startsWith("--"));
if (!url) {
  console.error("Usage: npm run check -- <url> [--method GET|POST] [--body '{}'] [--expect-pay-to 0x...] [--expect-amount 1000]");
  process.exit(2);
}

try {
  const method = (valueAfter(args, "--method") ?? "GET").toUpperCase() as "GET" | "POST";
  const bodyRaw = valueAfter(args, "--body");
  const request: CheckRequest = {
    url,
    method,
    ...(bodyRaw ? { body: JSON.parse(bodyRaw) } : {}),
    expectations: {
      network: valueAfter(args, "--expect-network") ?? "eip155:8453",
      asset: valueAfter(args, "--expect-asset") ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ...(valueAfter(args, "--expect-pay-to") ? { payTo: valueAfter(args, "--expect-pay-to") } : {}),
      ...(valueAfter(args, "--expect-amount") ? { amount: valueAfter(args, "--expect-amount") } : {}),
    },
  };
  const report = await checkX402Endpoint(request);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 2;
}
