# Public Marketplace coordinated demo checklist

This is the release record for issue #55. Keep transaction hashes, account addresses, provider delivery IDs, and raw Event or Pass IDs out of buyer-facing screenshots.

## Release identity

| Item | Recorded value |
| --- | --- |
| Network | Arbitrum Sepolia (`421614`) |
| Event Pass | `0xf38c46f74ced7b5b5784b8eed24a17bfafcac12d` |
| Deployment transaction | `0xf16ab268e147ecc407940dc08e25265ff069a574a0ecbe7765480ac80e9b5ee1` |
| Deployment block | `296886296` |
| Contract source revision | `7fb346c9c37432fedbb97a454a304871ce6a5c6a` |
| Shared backend revision | `f8d75a25bc46f6f001fa1ede44b733dd224dbe99` |
| Shared Convex deployment | `dev:brilliant-chihuahua-114` |
| Buyer deployment URL/revision | Not available under the authenticated Vercel account |

Run the compatibility gate before every smoke:

```bash
MINT_UP_PROD_ROOT=/absolute/path/to/mint-up-corp yarn demo:validate
```

## Deployment gate

- [x] The public-only contract is deployed, starts empty, and has successful receipt and bytecode.
- [x] Live administrator, USDC, authorization signer, fee recipient, fees, and pause state match the release record.
- [x] Contract, generated buyer, and shared backend ABIs contain only the public listing interface.
- [x] The buyer environment and shared Convex deployment select the same chain, contract, block, and economy.
- [x] The shared backend revision is deployed and its legacy Event Pass projections were removed rather than migrated.
- [x] Native source verification passes against the recorded deployment transaction.
- [ ] Deploy the tested buyer revision and record its canonical URL.
- [ ] Run reproducible verification on native amd64 infrastructure.

## Automated verification

```bash
yarn stylus:test
yarn next:check-types
yarn next:lint
yarn workspace @ss/nextjs test
yarn next:build
STYLUS_VERIFY_NATIVE=1 yarn stylus-verify
MINT_UP_PROD_ROOT=/absolute/path/to/mint-up-corp yarn demo:validate
pnpm --filter @mint-up-corp/backend check-types
pnpm --filter @mint-up-corp/backend test
```

- [x] Contract formatting, clippy, 34 unit tests, ABI parity, and Stylus build pass.
- [x] Buyer typecheck, focused lint hooks, 287 tests, and production build pass.
- [x] Shared backend typecheck and 708 tests pass.
- [x] Cross-repository live compatibility gate passes.
- [ ] Full-repository buyer lint completes; the command produced no findings but did not exit within five minutes.

## Fresh pilot setup

- [ ] Create fresh pilot Events through the organizer flow after the Convex cutover.
- [ ] Publish fresh Event Pass configurations and verify they snapshot this contract and block.
- [ ] Acquire fresh Passes for a seller and two eligible protected buyers.
- [x] No Event Pass configuration, Pass instance, purchase, transfer, refund, or resale projection was migrated from the prior deployment.

## Desktop smoke

- [ ] Explore the public Marketplace without signing in and distinguish Pass resale from primary inventory.
- [ ] Publish by entering only a total USDC price and confirming biometrically.
- [ ] Verify the listing appears only after canonical reconciliation and exposes no seller identity.
- [ ] Resume one buyer through sign-in or account protection and revalidate the listing before review.
- [ ] Review total price, included 9% fee, seller net, Protected payment, balance, and cancellation policy.
- [ ] Submit two eligible buyers for one listing without a reservation.
- [ ] Verify exactly one buyer pays, the seller receives 91%, Mint Up receives 9%, ownership moves once, and the losing buyer returns to the Marketplace.
- [ ] Force a transactional email delivery failure after reconciliation and verify listing/payment/ownership remain authoritative and retries are idempotent.
- [ ] Verify buyer-visible pages contain no addresses, hashes, gas, wallet, approval, NFT, token, escrow, or seller identity.

## Mobile smoke

Repeat exploration, publication, onboarding, review, competing purchase, and failure recovery at a Pixel 7-sized viewport or on a physical device.

- [ ] Navigation, dialogs, forms, price disclosures, biometric prompts, errors, and retry controls are usable without horizontal scrolling.
- [ ] The same privacy and buyer-language audit passes.
