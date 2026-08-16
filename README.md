# Base Agent Meter

An x402-powered paid API for AI agents on Base.

## Mission

Base Agent Meter demonstrates a machine-to-machine payment flow where an agent requests an HTTP resource, receives `402 Payment Required`, pays in USDC on Base, and receives the protected JSON resource only after x402 verification and settlement.

The first resource will be a small Base network diagnostics / block-summary endpoint so the project demonstrates x402 infrastructure without pretending to sell financial alpha.

## Architecture target

```text
AI agent / x402 client
        |
        | GET protected resource
        v
Base Agent Meter API
        |
        | 402 + x402 v2 payment requirements
        v
USDC payment on Base
        |
        | verify + settle through facilitator
        v
Protected JSON response + usage receipt
```

## Protocol decisions

- x402 **v2** semantics.
- CAIP-2 network identifiers (`eip155:84532` for Base Sepolia during integration testing; `eip155:8453` for Base Mainnet production).
- USDC / EIP-3009 compatible payment flow.
- No private key in browser code.
- No custom payment protocol when official x402 libraries cover the flow.
- Mainnet is the production target; testnet is only a validation stage before real payments.
- Builder Code attribution will use the official Base-supported path and will not be claimed until it is actually verified.

## Build gates

Before this repository is considered complete:

- [ ] Protected endpoint returns a standards-compliant x402 v2 `402` response
- [ ] x402 client can pay and retrieve the protected resource
- [ ] Payment is verified/settled through a supported facilitator
- [ ] Automated tests cover unpaid access and protected-resource behavior
- [ ] Typecheck/lint/build are green
- [ ] Production deployment is live
- [ ] A real Base Mainnet payment is exercised and linked as proof
- [ ] Builder/agent attribution is wired and verified through official Base tooling

## Sources of truth

Implementation follows the current x402 v2 specification and Base's official builder guidance. API details will be re-checked against those sources before implementation rather than copied from stale examples.
