# Event Pass coordinated demo checklist

This is the release record for issue #44. Keep operator-only evidence such as transaction hashes, account addresses, provider delivery IDs, and raw Event or Pass IDs outside buyer-facing screenshots.

## Release identity

| Item                                | Recorded value                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Network                             | Arbitrum Sepolia (`421614`)                                                  |
| Event Pass                          | `0x1311051d9209f6f37b2eb6f35963e1073b5d067c`                                 |
| Deployment transaction              | `0x557e5a8164abed7660ae271421c278f0041fe6bd303e8dbaf6c82518846c09c0`         |
| Deployment block                    | `296513974`                                                                  |
| Contract source revision            | `02a31fdc454262cfc8980299d93e5450c44b7a9c`                                   |
| Buyer app deployed revision and URL | Not yet recorded                                                             |
| `mint-up-corp` deployed revision    | `e04a35256ba030b63c749f1c1fa51e701d5d3f43` (deployment confirmation pending) |
| Shared Convex deployment            | `dev:brilliant-chihuahua-114`                                                |

The immutable expected configuration is tracked in `docs/event-pass-demo-deployment.json`. Run the compatibility gate before every smoke:

```bash
MINT_UP_PROD_ROOT=/absolute/path/to/mint-up-corp yarn demo:validate
```

The command checks the complete function/event ABI across both repositories, buyer environment, shared Convex deployment row, live deployment receipt and bytecode, USDC, administrator, authorization signer, fee recipient, `500/900` fees, and paused state. Any mismatch exits nonzero and names the mismatched field.

## Deployment gate

- [x] New contract exists on Arbitrum Sepolia with successful deployment receipt.
- [x] Live administrator, USDC, authorization signer, fee recipient, primary fee `500`, resale fee `900`, and unpaused state match the release record.
- [x] Buyer app selects chain `421614`, the release contract, official Sepolia USDC, and the shared Convex URL.
- [x] Production Convex selects the same chain, contract, deployment block, fee recipient, and fee rates.
- [ ] Production Convex authorization signer account/address is configured. The compatibility gate currently reports `production.authorizationSignerAddress`.
- [x] Canonical, generated buyer, and production function/event ABI shapes match.
- [ ] Buyer app production deployment URL and revision are recorded above.
- [ ] Production Convex deployment revision is confirmed and recorded above.
- [ ] `yarn stylus-verify` passes with Docker running. The 2026-08-10 attempt was blocked because the local Docker daemon was unavailable.

Do not continue to the smoke while any deployment-gate item is open.

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
MINT_UP_PROD_ROOT=/absolute/path/to/mint-up-corp yarn demo:validate
```

Run the Nitro acceptance lifecycle against a freshly started local chain:

```bash
yarn chain
yarn deploy
yarn test:local
```

- [ ] Contract format, lint, unit tests, build, and Stylus verification pass.
- [ ] Buyer typecheck, lint, rendered tests, and production build pass.
- [ ] Production repository verification and build pass.
- [ ] Nitro protected-payment/cancellation/refund branch passes.
- [ ] Nitro independent release branch proves exact one-time `95/5` settlement.

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

- [ ] Protected balance remains in the contract before Event start.
- [ ] Release at/after Event start pays exactly 95% to the organizer and 5% to Mint Up, with deterministic rounding and exact conservation.
- [ ] A repeated release cannot pay again and production records one settlement.

## Collectible visibility and movement policy

- [ ] `supportsInterface` returns true for ERC-165, ERC-721, and ERC-721 Metadata.
- [ ] `name` is `Mint Up Event Pass`, `symbol` is `MUEP`, and `ownerOf` returns the verified holder.
- [ ] `tokenURI` is `ipfs://`; its JSON and referenced image resolve through the configured Pinata gateway.
- [ ] The collection/token is observed in an OpenSea-compatible Arbitrum Sepolia indexer, or the observation time and pending indexing latency are recorded.
- [ ] Standard approval and direct standard transfer are attempted and rejected.
- [ ] The same ownership change succeeds through Mint Up dual authorization.

## No migration

- [ ] Record old/new contract-address counts before and after cutover.
- [ ] Confirm the new contract began empty except for Events and Passes created for this demo.
- [ ] Confirm no Event Pass, protected balance, resale offer, or ownership history was copied or rewritten from an older deployment.
