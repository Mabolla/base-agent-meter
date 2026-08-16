import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { loadConfig } from "./config.js";
import { getBaseSnapshot } from "./snapshot.js";

const config = loadConfig();
const app = express();

const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(
  config.network,
  new ExactEvmScheme(),
);

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
