import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { CheckInputError, MAX_CHALLENGE_BYTES, pinnedLookup, requestPublicTarget, resolvePublicTarget } from "../src/public-http.js";

describe("public endpoint transport", () => {
  it.each([
    "127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "224.0.0.1",
    "::1", "::ffff:127.0.0.1", "::ffff:a00:1", "fe90::1", "fd00::1", "ff02::1",
  ])("rejects non-public DNS result %s", async address => {
    await expect(resolvePublicTarget("https://seller.example", async () => [address])).rejects.toBeInstanceOf(CheckInputError);
  });

  it("rejects mixed public/private DNS answers and mapped literal URLs", async () => {
    await expect(resolvePublicTarget("https://seller.example", async () => ["93.184.216.34", "10.0.0.1"])).rejects.toThrow(/public IP/);
    await expect(resolvePublicTarget("http://[::ffff:127.0.0.1]/")).rejects.toThrow(/public IP/);
  });

  it("pins the checked DNS answer for the connection instead of resolving it again", async () => {
    const resolver = vi.fn().mockResolvedValueOnce(["93.184.216.34"]).mockResolvedValue(["127.0.0.1"]);
    const target = await resolvePublicTarget("https://seller.example/paid", resolver);
    const callback = vi.fn();
    pinnedLookup(target.addresses)("seller.example", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("uses pinned routing, preserves Host, caps bodies, and does not follow redirects", async () => {
    let redirectTargetCalls = 0;
    const server = createServer((req, res) => {
      if (req.url === "/invalid-status") { res.writeHead(600); res.end(); return; }
      if (req.url === "/large") { res.end("a".repeat(MAX_CHALLENGE_BYTES + 1)); return; }
      if (req.url === "/redirect") { res.writeHead(302, { location: "/target" }); res.end(); return; }
      if (req.url === "/target") redirectTargetCalls++;
      res.writeHead(402, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ host: req.headers.host, method: req.method }));
    });
    server.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not listen");
    // A prevalidated target is constructed only inside this local transport test.
    const target = (path: string) => ({ url: new URL(`http://seller.invalid:${address.port}${path}`), addresses: ["127.0.0.1"] });
    try {
      const response = await requestPublicTarget(target("/paid"), { method: "GET", signal: AbortSignal.timeout(2_000) });
      expect(response.status).toBe(402);
      expect(await response.json()).toEqual({ host: `seller.invalid:${address.port}`, method: "GET" });
      const redirect = await requestPublicTarget(target("/redirect"), {});
      expect(redirect.status).toBe(302);
      expect(redirectTargetCalls).toBe(0);
      await expect(requestPublicTarget(target("/large"), {})).rejects.toThrow(/128 KiB/);
      await expect(requestPublicTarget(target("/invalid-status"), {})).rejects.toThrow(/status/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
