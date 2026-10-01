import { describe, expect, it } from "vitest";
import { Attribution } from "ox/erc8021";
import { concatHex } from "viem";
import { encodeBuilderCodeSuffix } from "@x402/extensions/builder-code";
import { inspectBuilderAttribution } from "../src/proof.js";

describe("settlement attribution formats", () => {
  const legacy = concatHex(["0x12345678", Attribution.toDataSuffix({ codes: ["bc_87fjmj1l"] })]);
  const x402 = concatHex(["0x12345678", encodeBuilderCodeSuffix({ a: "seller_code", s: ["service_code"] })]);

  it("recognizes the schema-0 format used by direct Base Receipt payments", () => {
    expect(inspectBuilderAttribution(legacy, "bc_87fjmj1l")).toMatchObject({ verified: true, format: "erc8021-schema-0", observed: { id: 0, codes: ["bc_87fjmj1l"] } });
  });
  it("does not verify an unexpected legacy code", () => {
    expect(inspectBuilderAttribution(legacy, "another_code").verified).toBe(false);
  });
  it("reports observed codes without silently selecting an expected code", () => {
    expect(inspectBuilderAttribution(legacy)).toMatchObject({ declared: null, verified: false, observed: { codes: ["bc_87fjmj1l"] } });
  });
  it("continues verifying schema-2 application codes", () => {
    expect(inspectBuilderAttribution(x402, "seller_code")).toMatchObject({ format: "erc8021-schema-2", observed: { a: "seller_code" }, verified: true });
  });
  it("does not mistake a schema-2 service code for the application code", () => {
    expect(inspectBuilderAttribution(x402, "service_code").verified).toBe(false);
  });
  it("does not verify a code with an unvalidated custom registry", () => {
    const custom = Attribution.toDataSuffix({ codes: ["bc_87fjmj1l"], codeRegistry: { address: "0x1111111111111111111111111111111111111111", chainId: 8453 } });
    expect(inspectBuilderAttribution(custom, "bc_87fjmj1l").verified).toBe(false);
  });
  it("does not verify missing or truncated suffixes", () => {
    expect(inspectBuilderAttribution("0x12345678", "bc_87fjmj1l").verified).toBe(false);
    expect(inspectBuilderAttribution(legacy.slice(0, -2) as `0x${string}`, "bc_87fjmj1l").verified).toBe(false);
  });
});
