# Base Agent Meter

An **x402 v2 paid API for AI agents on Base Mainnet**.

The first resource is `GET /api/base-snapshot`: a machine-readable Base block/gas snapshot. The route is protected by the official x402 server stack and accepts a tiny USDC payment on Base before the handler runs.

## Live production

- Service: `https://base-agent-meter-production.up.railway.app`
- Paid resource: `GET https://base-agent-meter-production.up.railway.app/api/base-snapshot`
- Price: `$0.001` USDC
- Network: Base Mainnet (`eip155:8453`)

An unpaid browser/client request returns HTTP `402 Payment Required`. A real x402 client payment has been exercised end to end and returned HTTP `200` with the protected Base snapshot.

## Verified Mainnet proof

A real `$0.001` x402 payment was settled successfully on Base Mainnet on 2026-08-16.

- Payer: `0x30eFBc8e3815762014C22b0947c5a416d3d4C6d7`
- Transaction: `0x3351988e6d37bc8dad9ca0e934f027503003168c470833450e33b71e6bc77d84`
- x402 settlement response: `success: true`
- HTTP result after payment: `200`
- Protected response: `paid: true`, `protocol: x402-v2`, Base Mainnet snapshot (`chainId: 8453`)

Explorer: `https://basescan.org/tx/0x3351988e6d37bc8dad9ca0e934f027503003168c470833450e33b71e6bc77d84`

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
   |-- no valid payment --> 402 + payment requirements
   |-- payment supplied --> CDP facilitator verify/settle
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

The production server uses `createCdpFacilitatorClient()` with `x402ResourceServer`, `ExactEvmScheme`, and Express `paymentMiddleware`. CDP credentials are supplied only through production environment variables and are not committed to the repository.

## Safety choices

- `PAY_TO` must be an explicit valid EVM address; there is no embedded receiver wallet.
- Production config rejects accidental Base Sepolia/network substitution.
- CDP facilitator credentials stay in deployment environment variables, not source control.
- The paid resource is read-only and has no trading or asset-management behavior.
- The real-payment smoke client reads its payer key only from `EVM_PRIVATE_KEY`; no payer key is committed.
- The first real payment was deliberately tiny (`$0.001`).

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
- [ ] Register/complete the project on Base.dev
- [ ] Obtain the official Builder Code and integrate ERC-8021 attribution through a supported path
- [ ] Verify Builder Code attribution on a subsequent transaction

The core x402 product is now verified end to end on Base Mainnet. Base.dev registration and Builder Code attribution remain explicit final distribution/attribution steps rather than being claimed prematurely.
