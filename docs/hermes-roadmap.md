# Hermes: useful Base operations and FLOP readiness

Updated: 2026-10-09. Owner repository: Mabolla/base-agent-meter.

## Outcome

Use Hermes for actual work: checking a paid API before use, verifying its settled payment and requested attribution, and producing an evidence-backed report. Reuse the existing Base Receipt and Meter services. Do not create a third product or add a parallel checker implementation.

The longer-term FLOP use case is to purchase inference for these useful jobs and record completed sessions, cost and output quality. This is a future integration, not a current capability.

## Work order and completion gates

| Stage | Deliverable | Completion gate |
| --- | --- | --- |
| 1 | Existing Meter MCP connection example and evidence runner | Live discovery and historical Base proof work; wrong expectations fail; repository tests pass. |
| 2 | Isolated Hermes runtime with one model provider | Hermes itself discovers Meter tools, performs the historical proof and correctly explains a negative case. Record Hermes version, model, tool trace and cost. |
| 3 | Real paid-API operations | Select one genuinely useful external Base x402 API. Check pinned payment terms; make one explicitly approved low-cost purchase through the existing canary; verify settlement and protected response. Never automatically retry a payment. |
| 4 | Repeat useful work | Perform at least three useful jobs on separate sessions. Track accepted outputs, actual costs, failure reasons and recovery after interruption. |
| 5 | Reusable Nous contribution | Package the tested integration and instructions in this repository; get an independent user to reproduce it. Any upstream Hermes bug needs reproduction on current main and a focused fix. |
| 6 | FLOP provider integration | Official endpoints, authentication, settlement and session evidence are published; connect Hermes using the actual supported protocol and run a real useful job. |
| 7 | Persistent operation | Choose an accessible persistent host only after stage 2. Prove restart recovery for one task, bounded spend and no duplicate paid execution before scheduling more work. |

Stage order is deliberate. A testnet launch does not make a nonexistent API usable. Stage 6 can move forward once its requirements are actually available; Base work remains useful independently.

## FLOP facts and unresolved requirements

The official draft says Q4 2026, approximately 90 days, with dates and rules provisional. It requires an agent DID, wallet and faucet access; agent scoring concerns compute purchased in settled sessions. The whitepaper says Technocore key creation/message posting alone is not eligible work. Do not infer an October/November launch date or a guaranteed allocation.

Before implementing a live FLOP adapter, obtain official provider/session API, supported models, wallet/DID authentication, test-token faucet, signed purchase format, session settlement receipts, rate limits and finalized activity rules. We have not verified these implementation details.

The existing Technocore Task Relay and companion ops work remain separate. Reuse them only after reviewing their actual state; this change does not deploy them or transfer identity keys.

## Continuity and budget

One implementation task at a time. At each stop, update `docs/hermes-status.md` with tested behavior, unresolved requirements and the next command/task. Version code and evidence together. A new chat resumes from these records, not an assumed memory.

Initial infrastructure: existing public Meter service and an isolated Hermes runtime. Add one paid model provider when needed. A persistent host is a later concrete decision; no paid account was opened by this change. Spending authorization and actual service credentials are separate requirements. Record cost per useful job; no budget or quota figures are presumed.

Read-only checks produce no onchain activity. Rechecking our own transaction is a functionality test, not external adoption or a new attributed transaction. Builder usefulness must come from actual consumers and useful repeated work, not artificial volume.

## Sources

- https://hermes-agent.nousresearch.com/docs/developer-guide/contributing/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/
- https://flop.finance/testnet/
- https://flop.finance/whitepaper/
- https://github.com/Mabolla/base-receipt#mainnet-proof

