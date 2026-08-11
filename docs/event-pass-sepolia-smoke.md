# Public Marketplace Sepolia smoke evidence

Release evidence for the public-only Event Pass contract deployed on 2026-08-10.

## Deployment

- Network: Arbitrum Sepolia (`421614`)
- Contract: `0xf38c46f74ced7b5b5784b8eed24a17bfafcac12d`
- Deployment transaction: `0xf16ab268e147ecc407940dc08e25265ff069a574a0ecbe7765480ac80e9b5ee1`
- Deployment block: `296886296`
- Contract source revision: `7fb346c9c37432fedbb97a454a304871ce6a5c6a`
- Administrator: `0xBE79FcF42348B143547c2d9f1a66C3C83BB7915b`
- Authorization signer: `0x9CbF24Cd10948992E6912Fb4a4C0433D7A3E985C`
- Fee recipient: `0x0fb249b159543BCcE6f1f649DAdfe2f31a4a80D9`
- USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- Primary/resale fees: `500/900` bps
- Initial state: unpaused, with no Event or Pass logs through block `296886907`
- Native source verification: passed

The generated buyer ABI and shared backend ABI expose only public fixed-price resale listings. The prior Event Pass domain projections were cleared instead of migrated, and the shared Convex deployment now points to this contract and deployment block.

## Automated evidence

- Contract tests: 34 passed, including open listings, exact authorization, 91/9 conservation, two buyers competing without a reservation, failed USDC legs, reentrancy, lifecycle invalidation, and pause without revival.
- Buyer tests: 287 passed.
- Shared backend tests: 708 passed, including public privacy-safe projection, concurrency, canonical reconciliation, and notification failure independence.
- Buyer production build: passed.
- Cross-repository live parity gate: passed for contract, ABI, buyer environment, Convex deployment, USDC, administrator, signer, recipient, fees, and pause state.

## Coordinated smoke still required

The authenticated production journey needs organizer, seller, and two protected buyer sessions plus a linked buyer deployment. Do not mark release acceptance complete until the checklist records:

- fresh pilot Events and Event Passes created against this deployment;
- price-only publication, verified reconciliation, and public discovery;
- two buyers submitting for one listing, with exactly one USDC payment;
- exact 91% seller proceeds, 9% Mint Up fee, and final ownership;
- a real delivery failure after reconciliation without changing listing, payment, or ownership state; and
- publication, onboarding, review, and purchase on desktop and mobile.
