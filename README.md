# Base Agent Meter - x402 Production Assurance

Base Agent Meter answers one production question:

> Can an autonomous agent discover, pay for, settle, and successfully consume my x402 service right now, and can I prove the Base transaction and attribution?

It is a focused assurance tool for teams operating x402-paid APIs on Base. It provides an unpaid pre-deploy check, an explicitly gated real-buyer canary, and Base-native settlement proof.

## 1. Pre-deploy and CI check

The checker contacts a public seller endpoint without providing payment and validates reachability, x402 v2 negotiation, Base Mainnet, Base USDC, positive atomic amount, valid `payTo`, pinned expectation drift, Bazaar metadata, and declared ERC-8021 builder attribution.

Builder attribution in a 402 response is reported as **declared**, never verified. Verification requires a completed settlement transaction.

```bash
npm run check -- https://api.example.com/paid-resource --expect-pay-to 0xYourExpectedRecipient --expect-amount 1000
```

For POST resources:

```bash
npm run check -- https://api.example.com/paid-resource --method POST --body '{"query":"value"}'
```

The CLI prints JSON. `FAIL` exits with code 1 and invalid input exits with code 2. `PASS` and `WARN` exit successfully so teams can choose their warning policy. The same workflow is available through `POST /api/check`. Public DNS resolution is checked and private, loopback, link-local, and carrier-grade NAT targets are rejected.

## 2. Live paid canary

The canary follows the real buyer path:

```text
402 negotiation -> payment preparation -> payment -> settlement -> protected response -> Base proof
```

Dry-run is the default and never loads a payer key:

```bash
npm run build
npm run canary -- https://api.example.com/paid-resource
```

A real payment requires pinned expectations and an explicit confirmation token:

```env
CANARY_EXPECT_PAY_TO=0xApprovedRecipient
CANARY_EXPECT_AMOUNT=1000
CANARY_CONFIRM=PAY_BASE_MAINNET_CANARY
EVM_PRIVATE_KEY=dedicated-low-balance-wallet-key
```

```bash
npm run canary -- https://api.example.com/paid-resource --execute
```

The runner refuses to continue if the observed Base Mainnet network, Base USDC contract, amount, or recipient differs from the approved values. It verifies the settlement response and protected HTTP response, records settlement evidence, then waits for a public RPC receipt before reading the transaction. This polling handles the interval in which a facilitator has reported success but the transaction is not yet indexed by the configured RPC.

Retries are not automatic because repeating a paid request may create another settlement.

## 3. Base-native proof

After a completed canary, Base Agent Meter verifies transaction inclusion and status, Base USDC `Transfer` evidence, expected payer, recipient, and amount, and the ERC-8021 calldata suffix when present. The result distinguishes declared, observed, and verified builder attribution.

The canary writes a JSON artifact under `artifacts/` containing endpoint, timestamp, payment terms, payer, transaction hash, response status, latency, response body hash, USDC evidence, and builder-attribution evidence. Existing transactions can be checked through `POST /api/proof/verify`.

## Existing deployed seller fixture

The repository preserves the original paid Base snapshot as an optional self-test fixture. The deployment predates the Production Assurance pivot.

- Service: `https://base-agent-meter-production.up.railway.app`
- Resource: `GET /api/base-snapshot`
- Price: `$0.001` USDC
- Network: Base Mainnet (`eip155:8453`)
- Base app ID: `6a81d256b92232d481b384bc`
- Official Builder Code: `bc_h2oqnbbh`

The fixture is enabled only when `PAY_TO`, `CDP_API_KEY_ID`, and `CDP_API_KEY_SECRET` are configured. It uses the official x402 server stack, CDP facilitator, Bazaar declaration, and builder-code extension. The homepage retains Base app ownership metadata.

### Verified seller-fixture proof

A real `$0.001` fixture payment settled on Base Mainnet on 2026-08-16:

- Payer: `0x30eFBc8e3815762014C22b0947c5a416d3d4C6d7`
- Transaction: `0xb053dee1d2ebe6f47ad41408bffc58555c1b66be761aee2ef969c3b47460e96f`
- Settlement response: `success: true`
- Protected response: HTTP 200 with `paid: true` and `protocol: x402-v2`
- Attribution: transaction calldata contains Builder Code `bc_h2oqnbbh` and the ERC-8021 suffix marker
- Base Dashboard: the registered app reported one transaction in the `Other` analytics category

Explorer: `https://basescan.org/tx/0xb053dee1d2ebe6f47ad41408bffc58555c1b66be761aee2ef969c3b47460e96f`

This evidence verifies the seller fixture's payment and attribution path. It does not claim Base App-originated user traffic, broader adoption, or ongoing service availability.

## Local server

```bash
npm install
npm run typecheck
npm test
npm run build
npm start
```

Open `http://localhost:4021` for the checker. Assurance workflows require no seller or wallet credentials.

Optional fixture configuration:

```env
PAY_TO=0xBaseMainnetRecipient
CDP_API_KEY_ID=your-cdp-key-id
CDP_API_KEY_SECRET=your-cdp-key-secret
BUILDER_CODE=bc_h2oqnbbh
```

## Safety boundaries

- Checks are read-only and never submit payment headers.
- Canary dry-runs do not load or require a private key.
- Real payment requires pinned expectations and a confirmation token.
- Secrets remain environment-only and are excluded from git.
- Tests do not sign or broadcast transactions.
- Reports use observed results; no synthetic uptime or transaction data is generated.
