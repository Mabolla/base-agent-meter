# Hermes work checkpoint

Updated: 2026-10-09.

## Completed

- Reviewed current Base Receipt and Meter source, MCP tool contracts and deployment history.
- Corrected stale planning premise: Base Receipt already records a fresh wallet-approved MCP payment and receipt on 2026-10-01. Autonomous Hermes use remains unproven.
- Added isolated Hermes MCP configuration example and SDK-based evidence runner to existing Meter repo.
- Runner distinguishes tool/transport errors, successful settlement, failed expectation matches and required Builder Code verification.
- Tests: 38 passed across seven files; TypeScript typecheck passed; dependency installation also completed production TypeScript build.
- Live hosted MCP historical proof: PASS at 2026-10-09T17:15:07.927Z. Transaction `0xae5b6ab118a58aed27c89b05ef9af7e75406487d4d42496284e6767f6cf14483`, block 52047238, 10000 atomic USDC, recipient/payer `0x94705A9d675daa924F9190Eca4c05ED6B12d5345`, schema-0 `bc_87fjmj1l` verified. Reported duration 22398 ms. No new transaction or receipt claim.
- Live negative check: FAIL as expected at 2026-10-09T17:16:55.911Z with amount 10001 instead of 10000. The transaction and attribution succeeded but the requested transfer did not match; the runner did not label it successful. Duration 21668 ms.

## Not completed

- Hermes installation/runtime selection, model authentication and actual model-driven MCP run.
- Fresh external paid-API purchase and response-delivery evidence.
- Persistent hosting, scheduled operation and task recovery.
- FLOP provider/session integration; official implementation requirements remain unresolved.
- Independent user reproduction or adoption.

## Next task

Inspect existing accessible Hermes runtime before provisioning another. Configure an isolated profile with the supplied Meter block and one provider. Run the historical proof and wrong-amount task through Hermes itself. Record version, model, tool trace, verdict and actual usage/cost. Do not claim full Hermes integration based only on the SDK runner.

See `docs/hermes-roadmap.md` for subsequent gates and `docs/hermes-integration.md` for commands.
