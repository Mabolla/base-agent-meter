# Base Agent Meter

An **x402 v2 paid API for AI agents on Base Mainnet**.

The first resource is `GET /api/base-snapshot`: a machine-readable Base block/gas snapshot. The route is protected by the official x402 server stack and accepts a tiny USDC payment on Base before the handler runs.

## Live production

- Service: `https://base-agent-meter-production.up.railway.app`
- Paid resource: `GET https://base-agent-meter-production.up.railway.app/api/base-snapshot`
- Price: `$0.001` USDC
- Network: Base Mainnet (`eip155:8453`)
- Base Builder Code: `bc_h2oqnbbh`

An unpaid browser/client request returns HTTP `402 Payment Required`. A real x402 client payment has been exercised end to end and returned HTTP `200` with the protected Base snapshot.

## Verified Mainnet proof

A real `$0.001` x402 payment with Base Builder Code attribution was settled successfully on Base Mainnet on 2026-08-16.

- Payer: `0x30eFBc8e3815762014C22b0947c5a416d3d4C6d7`
- Transaction: `0xb053dee1d2ebe6f47ad41408bffc58555c1b66be761aee2ef969c3b47460e96f`
- x402 settlement response: `success: true`
- HTTP result after payment: `200`
- Protected response: `paid: true`, `protocol: x402-v2`, Base Mainnet snapshot (`chainId: 8453`)
- Builder Code: `bc_h2oqnbbh`
- Attribution verification: the public transaction calldata contains the Builder Code followed by the ERC-8021 suffix marker (`0x8021` repeated in the suffix)

Explorer: `https://basescan.org/tx/0xb053dee1d2ebe6f47ad41408bffc58555c1b66be761aee2ef969c3b47460e96f`

## Why this exists

Agents should be able to buy API access without accounts, API keys, subscriptions, or a human checkout page. HTTP 402 plus onchain USDC gives the resource itself a machine-readable price and payment flow.

This project intentionally differs from Base Receipt: Base Receipt is a human-facing Base Pay checkout with independent settlement verification; Base Agent Meter is an **agent-facing HTTP 402 resource server**.

## Current architecture

```text
agent/client
   |
   | GET /api/base-snapshot
   v
x402 payment middleware
   |-- no valid payment --> 402 + payment requirements + Builder Code extension
   |-- payment supplied --> CDP facilitator verify/settle
   v
Base Mainnet settlement with ERC-8021 attribution
   v
paid route handler
   |
   +--> Base Mainnet RPC
   v
JSON block/gas snapshot
```

## x402 configuration

- Protocol generation: x402 v2
- Payment scheme: `exact`
- Network: Base Mainnet (`eip155:8453`)
- Mainnet facilitator: authenticated Coinbase Developer Platform x402 facilitator
- Default price: `$0.001`
- Builder Code extension: official `@x402/extensions/builder-code` resource-server integration

The production server uses `createCdpFacilitatorClient()` with `x402ResourceServer`, `ExactEvmScheme`, Express `paymentMiddleware`, and `declareBuilderCodeExtension()` for Base attribution. CDP credentials are supplied only through production environment variables and are not committed to the repository.

## Safety choices

- `PAY_TO` must be an explicit valid EVM address; there is no embedded receiver wallet.
- Production config rejects accidental Base Sepolia/network substitution.
- CDP facilitator credentials stay in deployment environment variables, not source control.
- The paid resource is read-only and has no trading or asset-management behavior.
- The real-payment smoke client reads its payer key only from `EVM_PRIVATE_KEY`; no payer key is committed.
- Real-payment verification uses a deliberately tiny `$0.001` payment.

## Run

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Required production value:

```env
PAY_TO=0xYourBaseMainnetReceiver
```

Free health endpoint:

```bash
curl http://localhost:4021/health
```

An unpaid request to the protected endpoint should return HTTP `402` with x402 payment requirements:

```bash
curl -i http://localhost:4021/api/base-snapshot
```

## Real-payment smoke client

`scripts/pay-smoke.mjs` exercises the production x402 flow with a dedicated low-balance Base wallet. It accepts both the 64-character MetaMask export format and a `0x`-prefixed 32-byte EVM private key.

```bash
EVM_PRIVATE_KEY=<dedicated-test-wallet-key> npm run pay:smoke
```

Never commit a payer key or use a high-value wallet for smoke testing.

## Completion gates

- [x] Official x402 v2 server API selected from current upstream examples
- [x] Base Mainnet CAIP-2 network configured
- [x] Protected agent-consumable endpoint implemented
- [x] Explicit receiver-address validation
- [x] Tests for network/address safety
- [x] GitHub Actions typecheck + test + build gate
- [x] Capture green CI
- [x] Deploy production service
- [x] Confirm unpaid production request returns a valid 402 challenge
- [x] Make one tiny real x402 USDC payment on Base Mainnet
- [x] Capture settlement/explorer proof
- [x] Register the production project with Base and verify domain ownership
- [x] Obtain the official Base Builder Code (`bc_h2oqnbbh`)
- [x] Integrate Builder Code through the official x402 builder-code extension
- [x] Verify Builder Code / ERC-8021 attribution in a subsequent Base Mainnet transaction

**Base Agent Meter v1 is verified end to end:** production deployment, x402 payment, Base Mainnet settlement, Base app registration, and onchain Builder Code attribution.
