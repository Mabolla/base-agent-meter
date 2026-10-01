import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

export class CheckInputError extends Error {}

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blockedV6.addSubnet(address, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  // Restrict IPv6 to global unicast; this also rejects IPv4-mapped private addresses.
  return family === 6 && globalV6.check(address, "ipv6") && !blockedV6.check(address, "ipv6");
}

export interface PublicTarget { url: URL; addresses: string[] }

async function resolveHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map(record => record.address);
}

export async function resolvePublicTarget(rawUrl: string, resolver = resolveHost): Promise<PublicTarget> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new CheckInputError("url must be a valid absolute URL"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new CheckInputError("url must use http or https");
  if (url.username || url.password) throw new CheckInputError("url credentials are not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(hostname) ? [hostname] : await Promise.race([
    resolver(hostname),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CheckInputError("DNS resolution timed out")), 12_000);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(address => !isPublicAddress(address))) {
    throw new CheckInputError("url must resolve only to public IP addresses");
  }
  return { url, addresses };
}

export function pinnedLookup(addresses: readonly string[]): LookupFunction {
  const records = addresses.map(address => ({ address, family: isIP(address) }));
  return (_hostname, options, callback) => {
    if (options.all) callback(null, records);
    else callback(null, records[0].address, records[0].family);
  };
}

export const MAX_CHALLENGE_BYTES = 128 * 1024;

/** Connect only to the addresses already checked; preserve hostname for Host and TLS SNI. */
export async function requestPublicTarget(target: PublicTarget, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = target.url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(target.url, {
      method: init.method ?? "GET",
      headers: Object.fromEntries(new Headers(init.headers)),
      lookup: pinnedLookup(target.addresses),
      agent: false,
      maxHeaderSize: 16 * 1024,
      signal: init.signal ?? undefined,
    }, res => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("error", reject);
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_CHALLENGE_BYTES) {
          req.destroy(new Error("Endpoint response exceeds 128 KiB"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(res.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          const status = res.statusCode ?? 502;
          resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers }));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end(typeof init.body === "string" ? init.body : undefined);
  });
}
