# Base Agent Meter

An **x402 v2 paid API for AI agents on Base Mainnet**.

The first resource is `GET /api/base-snapshot`: a machine-readable Base block/gas snapshot. The route is protected by the official x402 server stack and accepts a tiny USDC payment on Base before the handler runs.

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
   |-- payment supplied --> facilitator verify/settle
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
- Mainnet facilitator: CDP x402 (`https://api.cdp.coinbase.com/platform/v2/x402`)
- Default price: `$0.001`

The implementation follows the current official `coinbase/x402` TypeScript server API: `HTTPFacilitatorClient`, `x402ResourceServer`, `ExactEvmScheme`, and Express `paymentMiddleware`.

## Safety choices

- `PAY_TO` must be an explicit valid EVM address; there is no embedded receiver wallet.
- Production config rejects accidental Base Sepolia/network substitution.
- No private key is required by the resource server.
- The paid resource is read-only and has no trading or asset-management behavior.
- First real payment should remain deliberately tiny.

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

## Completion gates

- [x] Official x402 v2 server API selected from current upstream examples
- [x] Base Mainnet CAIP-2 network configured
- [x] Protected agent-consumable endpoint implemented
- [x] Explicit receiver-address validation
- [x] Tests for network/address safety
- [x] GitHub Actions typecheck + test gate
- [ ] Capture green CI
- [ ] Deploy production service
- [ ] Confirm unpaid production request returns a valid 402 challenge
- [ ] Make one tiny real x402 USDC payment on Base Mainnet
- [ ] Capture settlement/explorer proof
- [ ] Add Builder Code attribution only through an officially supported path and verify it

No completion claim will be made until the real Mainnet x402 flow is exercised end to end.
