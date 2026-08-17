import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { parsePaymentRequired } from "@x402/core/schemas";
import { getAddress, isAddress } from "viem";

export const BASE_MAINNET = "eip155:8453";
export const BASE_USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

export type AssuranceStatus = "PASS" | "WARN" | "FAIL";
export type FindingLevel = "pass" | "warn" | "fail";

export interface CheckExpectations {
  network?: string;
  asset?: string;
  payTo?: string;
  amount?: string;
}

export interface CheckRequest {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  expectations?: CheckExpectations;
}

export interface AssuranceFinding {
  level: FindingLevel;
  code: string;
  message: string;
}

export interface AssuranceReport {
  status: AssuranceStatus;
  checkedAt: string;
  endpoint: string;
  durationMs: number;
  negotiation: {
    reachable: boolean;
    httpStatus?: number;
    contentType?: string | null;
    x402Version?: number;
  };
  payment?: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
  };
  discovery: {
    bazaar: "present" | "missing" | "unavailable";
    builderAttribution: "declared" | "not_declared" | "unavailable";
    builderCode?: string;
  };
  expectations: CheckExpectations;
  findings: AssuranceFinding[];
}

export class CheckInputError extends Error {}

interface CheckDependencies {
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
  now?: () => Date;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (!isIP(address)) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map(record => record.address);
}

async function validatePublicUrl(rawUrl: string, resolveHost: (hostname: string) => Promise<string[]>): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CheckInputError("url must be a valid absolute URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new CheckInputError("url must use http or https");
  }
  if (url.username || url.password) throw new CheckInputError("url credentials are not allowed");
  const addresses = await resolveHost(url.hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new CheckInputError("url must resolve only to public IP addresses");
  }
  return url;
}

function decodeChallenge(response: Response, body: unknown): unknown {
  const header = response.headers.get("payment-required");
  if (header) return decodePaymentRequiredHeader(header);
  return body;
}

function compareExpectation(
  findings: AssuranceFinding[],
  field: keyof CheckExpectations,
  expected: string | undefined,
  observed: string,
) {
  if (expected === undefined) return;
  const normalize = (value: string) => isAddress(value) ? getAddress(value) : value;
  if (normalize(expected) === normalize(observed)) {
    findings.push({ level: "pass", code: `expected_${field}`, message: `${field} matches the expected value.` });
  } else {
    findings.push({ level: "fail", code: `${field}_drift`, message: `${field} changed: expected ${expected}, observed ${observed}.` });
  }
}

function finalStatus(findings: AssuranceFinding[]): AssuranceStatus {
  if (findings.some(finding => finding.level === "fail")) return "FAIL";
  if (findings.some(finding => finding.level === "warn")) return "WARN";
  return "PASS";
}

export async function checkX402Endpoint(input: CheckRequest, dependencies: CheckDependencies = {}): Promise<AssuranceReport> {
  if (!input || typeof input !== "object" || typeof input.url !== "string") {
    throw new CheckInputError("url must be a valid absolute URL");
  }
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const resolveHost = dependencies.resolveHost ?? defaultResolveHost;
  const now = dependencies.now ?? (() => new Date());
  const startedAt = performance.now();
  const url = await validatePublicUrl(input.url, resolveHost);
  const method = input.method ?? "GET";
  if (method !== "GET" && method !== "POST") throw new CheckInputError("method must be GET or POST");
  const expectations = input.expectations ?? {};
  const findings: AssuranceFinding[] = [];
  const baseReport = {
    checkedAt: now().toISOString(),
    endpoint: url.toString(),
    expectations,
  };

  let response: Response;
  let responseBody: unknown;
  try {
    response = await fetchImpl(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: method === "POST" ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" },
      body: method === "POST" ? JSON.stringify(input.body ?? {}) : undefined,
    });
    const text = await response.text();
    try { responseBody = text ? JSON.parse(text) : undefined; } catch { responseBody = text; }
  } catch (error) {
    findings.push({ level: "fail", code: "endpoint_unreachable", message: error instanceof Error ? error.message : "Endpoint request failed." });
    return {
      ...baseReport,
      status: "FAIL",
      durationMs: Math.round(performance.now() - startedAt),
      negotiation: { reachable: false },
      discovery: { bazaar: "unavailable", builderAttribution: "unavailable" },
      findings,
    };
  }

  const negotiation = {
    reachable: true,
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    x402Version: undefined as number | undefined,
  };
  findings.push({ level: "pass", code: "endpoint_reachable", message: `Endpoint responded with HTTP ${response.status}.` });
  if (response.status >= 300 && response.status < 400) {
    findings.push({ level: "fail", code: "redirect_not_allowed", message: `Endpoint redirected to ${response.headers.get("location") ?? "an unspecified location"}. Check the final protected URL directly.` });
  } else if (response.status !== 402) {
    findings.push({ level: "fail", code: "missing_402", message: `Expected HTTP 402 negotiation, received HTTP ${response.status}.` });
  } else {
    findings.push({ level: "pass", code: "http_402", message: "Endpoint returned HTTP 402 Payment Required." });
  }

  let challenge: ReturnType<typeof parsePaymentRequired>["data"];
  try {
    const parsed = parsePaymentRequired(decodeChallenge(response, responseBody));
    if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join("; "));
    challenge = parsed.data;
    negotiation.x402Version = challenge.x402Version;
    findings.push({ level: "pass", code: "valid_payment_metadata", message: `Payment metadata is valid x402 v${challenge.x402Version}.` });
  } catch (error) {
    findings.push({ level: "fail", code: "invalid_payment_metadata", message: error instanceof Error ? error.message : "Payment metadata could not be decoded." });
    return {
      ...baseReport,
      status: "FAIL",
      durationMs: Math.round(performance.now() - startedAt),
      negotiation,
      discovery: { bazaar: "unavailable", builderAttribution: "unavailable" },
      findings,
    };
  }

  if (challenge.x402Version !== 2) {
    findings.push({ level: "fail", code: "unsupported_x402_version", message: `Production assurance requires x402 v2; observed v${challenge.x402Version}.` });
    return {
      ...baseReport,
      status: "FAIL",
      durationMs: Math.round(performance.now() - startedAt),
      negotiation,
      discovery: { bazaar: "unavailable", builderAttribution: "unavailable" },
      findings,
    };
  }

  const baseAccept = challenge.accepts.find(accept => accept.network === BASE_MAINNET);
  if (!baseAccept) {
    findings.push({ level: "fail", code: "base_not_accepted", message: `No ${BASE_MAINNET} payment option is advertised.` });
    return {
      ...baseReport,
      status: "FAIL",
      durationMs: Math.round(performance.now() - startedAt),
      negotiation,
      discovery: { bazaar: challenge.extensions?.bazaar ? "present" : "missing", builderAttribution: "unavailable" },
      findings,
    };
  }

  const payment = {
    scheme: baseAccept.scheme,
    network: baseAccept.network,
    asset: baseAccept.asset,
    amount: baseAccept.amount,
    payTo: baseAccept.payTo,
    maxTimeoutSeconds: baseAccept.maxTimeoutSeconds,
  };
  findings.push({ level: "pass", code: "base_mainnet", message: "Base Mainnet payment option is present." });
  if (!isAddress(payment.asset) || getAddress(payment.asset) !== BASE_USDC) {
    findings.push({ level: "fail", code: "unexpected_asset", message: `Expected Base USDC ${BASE_USDC}, observed ${payment.asset}.` });
  } else {
    findings.push({ level: "pass", code: "base_usdc", message: "Payment asset is Base Mainnet USDC." });
  }
  if (!/^\d+$/.test(payment.amount) || BigInt(payment.amount) <= 0n) {
    findings.push({ level: "fail", code: "invalid_amount", message: `Payment amount must be a positive atomic-unit integer; observed ${payment.amount}.` });
  }
  if (!isAddress(payment.payTo)) findings.push({ level: "fail", code: "invalid_pay_to", message: `payTo is not a valid EVM address: ${payment.payTo}.` });

  compareExpectation(findings, "network", expectations.network, payment.network);
  compareExpectation(findings, "asset", expectations.asset, payment.asset);
  compareExpectation(findings, "payTo", expectations.payTo, payment.payTo);
  compareExpectation(findings, "amount", expectations.amount, payment.amount);

  const bazaar = challenge.extensions?.bazaar ? "present" : "missing";
  if (bazaar === "present") findings.push({ level: "pass", code: "bazaar_declared", message: "Bazaar discovery metadata is present." });
  else findings.push({ level: "warn", code: "bazaar_missing", message: "Bazaar discovery metadata is not declared." });

  const builderExtension = challenge.extensions?.["builder-code"] as { info?: { a?: unknown } } | undefined;
  const builderCode = typeof builderExtension?.info?.a === "string" ? builderExtension.info.a : undefined;
  const builderAttribution = builderCode ? "declared" : "not_declared";
  if (builderCode) findings.push({ level: "pass", code: "builder_code_declared", message: `ERC-8021 app attribution is declared as ${builderCode}; it is not yet onchain-verified.` });
  else findings.push({ level: "warn", code: "builder_code_missing", message: "No ERC-8021 builder-code declaration is present." });

  return {
    ...baseReport,
    status: finalStatus(findings),
    durationMs: Math.round(performance.now() - startedAt),
    negotiation,
    payment,
    discovery: { bazaar, builderAttribution, ...(builderCode ? { builderCode } : {}) },
    findings,
  };
}
