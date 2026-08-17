import express from "express";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { BUILDER_CODE, builderCodeResourceServerExtension, declareBuilderCodeExtension } from "@x402/extensions/builder-code";
import { isAddress, isHash } from "viem";
import { checkX402Endpoint, CheckInputError, type CheckRequest } from "./assurance.js";
import { loadConfig } from "./config.js";
import { renderHomePage } from "./page.js";
import { verifyBaseSettlement } from "./proof.js";
import { getBaseSnapshot } from "./snapshot.js";

const config = loadConfig();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
const baseAppId = "6a81d256b92232d481b384bc";

app.get("/", (_req, res) => res.type("html").send(renderHomePage().replace("<head>", `<head>\n  <meta name="base:app_id" content="${baseAppId}">`)));
app.get("/health", (_req, res) => res.json({ ok: true, service: "base-agent-meter", product: "x402-production-assurance", network: config.network }));
app.get("/api/meta", (_req, res) => res.json({ service: "base-agent-meter", product: "x402-production-assurance", network: config.network, asset: "USDC", workflows: { preDeployCheck: "POST /api/check", settlementProof: "POST /api/proof/verify", paidCanary: "npm run canary -- <endpoint>" }, sellerFixture: { enabled: Boolean(config.payTo && config.cdpConfigured), path: "/api/base-snapshot", builderAttribution: config.payTo ? { status: "declared", code: config.builderCode } : { status: "not_configured" } } }));
app.post("/api/check", async (req, res) => { try { const report = await checkX402Endpoint(req.body as CheckRequest); res.status(report.status === "FAIL" ? 422 : 200).json(report); } catch (error) { if (error instanceof CheckInputError || error instanceof SyntaxError) { res.status(400).json({ status: "FAIL", error: "invalid_check_request", message: error.message }); return; } console.error("assurance_check_failed", error); res.status(500).json({ status: "FAIL", error: "assurance_check_failed" }); } });
app.post("/api/proof/verify", async (req, res) => { const { transactionHash, expectedPayer, expectedPayTo, expectedAmount, declaredBuilderCode } = req.body ?? {}; if (!isHash(transactionHash) || !isAddress(expectedPayTo) || typeof expectedAmount !== "string" || !/^\d+$/.test(expectedAmount)) { res.status(400).json({ error: "invalid_proof_request", message: "transactionHash, expectedPayTo, and atomic-unit expectedAmount are required." }); return; } if (expectedPayer !== undefined && !isAddress(expectedPayer)) { res.status(400).json({ error: "invalid_proof_request", message: "expectedPayer must be a valid EVM address when supplied." }); return; } try { res.json({ verifiedAt: new Date().toISOString(), proof: await verifyBaseSettlement(config.rpcUrl, { transactionHash, expectedPayer, expectedPayTo, expectedAmount, declaredBuilderCode }) }); } catch (error) { console.error("settlement_proof_failed", error); res.status(502).json({ error: "base_proof_unavailable", message: error instanceof Error ? error.message : "Base RPC verification failed." }); } });

if (config.payTo && config.cdpConfigured) {
  const facilitator = createCdpFacilitatorClient();
  const resourceServer = new x402ResourceServer(facilitator).register(config.network, new ExactEvmScheme()).registerExtension(builderCodeResourceServerExtension);
  const discovery = declareDiscoveryExtension({ output: { example: { paid: true, protocol: "x402-v2", generatedAt: "ISO-8601 timestamp", snapshot: { network: "Base Mainnet" } }, schema: { type: "object", required: ["paid", "protocol", "generatedAt", "snapshot"] } } });
  app.use(paymentMiddleware({ "GET /api/base-snapshot": { accepts: [{ scheme: "exact", price: config.price, network: config.network, payTo: config.payTo }], description: "Base Agent Meter paid canary fixture returning a live Base Mainnet snapshot", mimeType: "application/json", extensions: { ...discovery, [BUILDER_CODE]: declareBuilderCodeExtension(config.builderCode) } } }, resourceServer));
  app.get("/api/base-snapshot", async (_req, res) => { try { res.json({ paid: true, protocol: "x402-v2", generatedAt: new Date().toISOString(), snapshot: await getBaseSnapshot(config.rpcUrl) }); } catch (error) { console.error("snapshot_failed", error); res.status(502).json({ error: "base_rpc_unavailable" }); } });
} else app.get("/api/base-snapshot", (_req, res) => res.status(503).json({ error: "seller_fixture_not_configured", required: ["PAY_TO", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET"] }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error("request_failed", error); if (!res.headersSent) res.status(503).json({ error: "x402_facilitator_unavailable" }); });
app.listen(config.port, () => console.log(`Base Agent Meter x402 Production Assurance listening on :${config.port}`));
