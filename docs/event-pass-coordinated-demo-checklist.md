# Event Pass coordinated demo checklist

This is the release record for issue #44. Keep operator-only evidence such as transaction hashes, account addresses, provider delivery IDs, and raw Event or Pass IDs outside buyer-facing screenshots.

## Release identity

| Item                                | Recorded value                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Network                             | Arbitrum Sepolia (`421614`)                                                  |
| Event Pass                          | `0xcdef01d755e4c68d3fc428a97f1d639c5fb44d62`                                 |
| Deployment transaction              | `0xb5c855184ac486fc9bffe79b4a61fbceb6193d4895643cfeb2b228f66b3108b9`         |
| Deployment block                    | `296796471`                                                                  |
| Contract source revision            | `02a31fdc454262cfc8980299d93e5450c44b7a9c`                                   |
| Buyer app deployed revision and URL | Not yet recorded                                                             |
| `mint-up-corp` deployed revision    | `e04a35256ba030b63c749f1c1fa51e701d5d3f43` (deployment confirmation pending) |
| Shared Convex deployment            | `dev:brilliant-chihuahua-114`                                                |

The immutable expected configuration is tracked in `docs/event-pass-demo-deployment.json`. Run the compatibility gate before every smoke:

```bash
MINT_UP_PROD_ROOT=/absolute/path/to/mint-up-corp yarn demo:validate
```

The command checks the complete function/event ABI across both repositories, buyer environment, shared Convex deployment row, live deployment receipt and bytecode, USDC, administrator, authorization signer, fee recipient, `500/900` fees, and paused state. Any mismatch exits nonzero and names the mismatched field.

Onchain smoke evidence is recorded in `docs/event-pass-sepolia-smoke.md`.

## Deployment gate

- [x] New contract exists on Arbitrum Sepolia with successful deployment receipt.
- [x] Live administrator, USDC, authorization signer, fee recipient, primary fee `500`, resale fee `900`, and unpaused state match the release record.
- [x] Buyer app selects chain `421614`, the release contract, official Sepolia USDC, and the shared Convex URL.
- [x] Production Convex selects the same chain, contract, deployment block, fee recipient, and fee rates.
- [x] Production Convex authorization signer account/address is configured and matches the immutable contract signer.
- [x] Canonical, generated buyer, and production function/event ABI shapes match.
- [ ] Buyer app production deployment URL and revision are recorded above.
- [ ] Production Convex deployment revision is confirmed and recorded above.
- [x] Native Stylus verification passes immediately after a clean build and deployment with `STYLUS_VERIFY_NATIVE=1 yarn stylus-verify`.
- [ ] Reproducible Docker verification passes. On 2026-08-10 Rust `1.91.0` segfaulted under amd64 emulation on Apple Silicon.

Do not continue to the coordinated browser/production smoke while any deployment-gate item is open. Contract-only Sepolia validation may proceed and is recorded separately.

## Automated verification

Run from the repository root and record the date/operator with the release evidence:

```bash
yarn stylus:format
yarn stylus:lint
yarn compile
yarn stylus:test
yarn next:check-types
yarn next:lint
yarn workspace @ss/nextjs test
yarn next:build
yarn stylus-verify
STYLUS_VERIFY_NATIVE=1 yarn stylus-verify
MINT_UP_PROD_ROOT=/absolute/path/to/mint-up-corp yarn demo:validate
```

Run the Nitro acceptance lifecycle against a freshly started local chain:

```bash
yarn chain
yarn deploy
yarn test:local
```

- [x] Contract format, lint, unit tests, build, and native Stylus verification pass.
- [ ] Buyer typecheck, lint, rendered tests, and production build pass.
- [x] Production Event Pass backend typecheck and 700 backend tests pass.
- [ ] Production repository verification and build pass.
- [x] Deployed Sepolia protected-payment/cancellation/refund branch passes.
- [x] Deployed Sepolia independent release branch proves exact one-time `95/5` settlement.

## Desktop smoke

- [ ] Create a new demo Event against this deployment; do not copy Events, Passes, protected balances, or offers from an older contract.
- [ ] Get Pass shows the Event, exact total USDC price, and Protected payment explanation under one Face ID or fingerprint confirmation.
- [ ] Transfer by recipient email completes only after verified reconciliation; the pass moves between My Passes views.
- [ ] Transfer transactional email is queued/observed. A delivery failure, if exercised, leaves verified ownership unchanged.
- [ ] Seller creates or replaces a private resale offer by email and human USDC price.
- [ ] Offer transactional email is queued/observed. A delivery failure, if exercised, leaves the verified offer unchanged.
- [ ] Only the designated buyer sees and purchases the offer; review states that cancellation returns the original protected price.
- [ ] Event Administrator completes Event Cancellation before the Event start.
- [ ] Current holder sees Devolucion disponible, receives the original protected amount, then sees Devolucion recibida with no repeat action.
- [ ] Buyer-visible pages and dialogs show no addresses, raw IDs, hashes, explorer links, gas, wallet, approval, NFT, token, or escrow terminology.

## Mobile smoke

Repeat the principal purchase, transfer, resale purchase, cancellation, and refund controls at a Pixel 7-sized viewport or a physical mobile device.

- [ ] Navigation, dialogs, forms, price disclosures, biometric prompts, errors, and Retry actions remain readable and usable without horizontal scrolling.
- [ ] The same buyer-jargon audit passes on mobile.

## Independent release smoke

Use a separate non-cancelled Event so cancellation/refund data cannot satisfy settlement evidence.

- [x] Protected balance remains in the contract before Event start.
- [x] Release at/after Event start pays exactly 95% to the organizer and 5% to Mint Up, with deterministic rounding and exact conservation.
- [x] A repeated onchain release cannot pay again. Production settlement projection remains to be observed.

## Collectible visibility and movement policy

- [x] `supportsInterface` returns true for ERC-165, ERC-721, and ERC-721 Metadata.
- [x] `name` is `Mint Up Event Pass`, `symbol` is `MUEP`, and `ownerOf` returns the onchain holder.
- [x] `tokenURI` is `ipfs://`; its JSON and referenced image resolve through a public Pinata gateway.
- [x] Arbiscan indexes the deployment as ERC-721 and exposes Token ID `5`.
- [x] Standard approval and direct standard transfer are attempted and rejected.
- [x] The same ownership change succeeds through Mint Up dual authorization.

## No migration

- [x] Record old/new contract-address separation before the smoke.
- [x] Confirm the new contract began empty except for Events and Passes created for this demo.
- [ ] Confirm production did not rewrite Event Pass, balance, offer, or ownership-history records from an older deployment.
