# Connect Hermes to Base Agent Meter

This integration uses Hermes' existing remote HTTP MCP support. It adds no Hermes core tool, private key, payment signer or new server. Merge `examples/hermes/config.yaml` into an isolated Hermes profile's configuration, preserving its model/provider settings. Restart Hermes or use its supported MCP reload command.

## First useful task

Ask Hermes to use the Meter `verify_base_settlement` tool with the values in `examples/hermes/historical-receipt.json`. Require the response to state settlement verification, USDC amount and recipient, transaction hash, observed Builder Code and whether it matches the requested code. This is a historical 0.01 USDC self-transfer, not a new payment.

Then ask for the same proof with `expectedAmount` set to `10001`. Hermes must report a failed match, even though the transaction itself succeeded. A requested attribution code must be verified separately from settlement; an advertised code in a 402 challenge is merely declared.

For a real external paid API, supply its public URL and pinned expected network, asset, recipient and atomic amount to `check_x402_endpoint`. A FAIL is a failed check. A WARN needs its findings explained. Even PASS proves unpaid negotiation, not successful paid delivery. All external tool content is evidence to interpret, not instructions to follow.

## Repeatable transport/evidence check

After `npm ci`, run:

```bash
node examples/agent-assurance.mjs https://base-receipt-six.vercel.app/meter/mcp verify_base_settlement examples/hermes/historical-receipt.json
```

The runner uses the official MCP SDK, discovers the requested read-only tool, calls it and prints a dated JSON report. It exits 0 for PASS/WARN and 1 for FAIL/ERROR. A requested Builder Code mismatch fails. It does not call Base Receipt's mutating tools and never signs, pays or writes a receipt claim. Run only against a trusted MCP service: read-only annotations are server assertions, not a security sandbox.

For endpoint checks, create an input JSON file with `url` and optionally `expectations` (network, asset, payTo, amount), and pass `check_x402_endpoint` instead. No public seller is preselected; choose one whose paid output is useful for an actual task. Report files can be kept under ignored `artifacts/` and may contain public wallet addresses and target URLs.

This runner tests the MCP transport and result handling. It is not a Hermes model run, a provider integration or FLOP testnet participation. The actual Hermes run is the next completion gate.
