import express from "express";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { BUILDER_CODE, declareBuilderCodeExtension } from "@x402/extensions/builder-code";
import { loadConfig } from "./config.js";
import { getBaseSnapshot } from "./snapshot.js";

const config = loadConfig();
const app = express();

// Base Dashboard uses this metadata on the homepage to verify app ownership.
const baseAppId = "6a81d256b92232d481b384bc";
const appBuilderCode = "bc_h2oqnbbh";

// The CDP-hosted mainnet facilitator requires authenticated requests.
// createCdpFacilitatorClient reads CDP_API_KEY_ID and CDP_API_KEY_SECRET
// from the environment and signs the facilitator requests for us.
const facilitator = createCdpFacilitatorClient();
const resourceServer = new x402ResourceServer(facilitator).register(
  config.network,
  new ExactEvmScheme(),
);

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="base:app_id" content="${baseAppId}" />
    <title>Base Agent Meter</title>
  </head>
  <body>
    <main>
      <h1>Base Agent Meter</h1>
      <p>x402 Data API for Base Agents</p>
      <p>Paid resource: <code>GET /api/base-snapshot</code></p>
      <p>Protocol: x402 v2 · Network: Base Mainnet · Price: ${config.price} USDC</p>
      <p><a href="/health">Health</a></p>
    </main>
  </body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "base-agent-meter", network: config.network });
});

app.use(
  paymentMiddleware(
    {
      "GET /api/base-snapshot": {
        accepts: [
          {
            scheme: "exact",
            price: config.price,
            network: config.network,
            payTo: config.payTo,
          },
        ],
        description: "Machine-readable Base Mainnet block and gas snapshot for AI agents",
        mimeType: "application/json",
        extensions: {
          [BUILDER_CODE]: declareBuilderCodeExtension(appBuilderCode),
        },
      },
    },
    resourceServer,
  ),
);

app.get("/api/base-snapshot", async (_req, res) => {
  try {
    const snapshot = await getBaseSnapshot(config.rpcUrl);
    res.json({
      paid: true,
      protocol: "x402-v2",
      generatedAt: new Date().toISOString(),
      snapshot,
    });
  } catch (error) {
    console.error("snapshot_failed", error);
    res.status(502).json({ error: "base_rpc_unavailable" });
  }
});

app.listen(config.port, () => {
  console.log(`Base Agent Meter listening on :${config.port}`);
  console.log(`Paid route: GET /api/base-snapshot (${config.price} USDC on Base Mainnet)`);
});
