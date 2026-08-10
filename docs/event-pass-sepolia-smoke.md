# Event Pass Sepolia smoke evidence

Executed on 2026-08-10 against Arbitrum Sepolia contract `0xcdef01d755e4c68d3fc428a97f1d639c5fb44d62`.

## Deployment

- Deployment transaction: `0xb5c855184ac486fc9bffe79b4a61fbceb6193d4895643cfeb2b228f66b3108b9`
- Deployment block: `296796471`
- Administrator: `0xBE79FcF42348B143547c2d9f1a66C3C83BB7915b`
- USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- Authorization signer: `0x9CbF24Cd10948992E6912Fb4a4C0433D7A3E985C`
- Fee recipient: `0x0fb249b159543BCcE6f1f649DAdfe2f31a4a80D9`
- Fees: primary `500` bps; resale `900` bps
- Native verification after a clean build: passed
- Reproducible Docker verification: blocked by a Rust `1.91.0` SIGSEGV under amd64 emulation on Apple Silicon

The previous deployment was `0x1311051d9209f6f37b2eb6f35963e1073b5d067c`; this smoke used only the new `0xcdef01d755e4c68d3fc428a97f1d639c5fb44d62` deployment. The new contract emitted no Event or Pass logs between deployment block `296796471` and the start of this smoke. No migration transaction was submitted to it; production record-level migration remains to be audited separately.

## Protected payment

- Event registration: `0x615938bd1a181e847b206e8fd3ef26269041db55e6aaca4800b3d17f4f56c69d`
- Cancelled Event purchase: `0xaa0f2b12a54f987d232a2302e1f9580552931d13403372ed05af80b1fad5d38f`
- Event cancellation: `0xc7ec9c80ec72bbccf932447c85de00ce5269482bbb2fb312ce10c4d013281e8c`
- Full original-price refund: `0xd566793d35e6bf7a4dd511560dfa5a137e36f2f933a8c2dc47f7701df4bdb31e`
- Independent Event purchase: `0x67d083d59c7e2873fdb81c239788c39990ef298ba115f01ada4ef8a4460e1b50`
- One-time release: `0x1820aec034b73276c309c08a0386814664a020dcf614ef5d281d17ceedc64e13`
- Release amounts: organizer `950000`, Mint Up `50000`; protected balance became zero
- A post-release `eth_call` to `releaseFunds` reverted with raw error data ending in `0x1b`, `MintUpError(27)`.

## Movement policy and resale

- Standard `approve` and `transferFrom` for Pass `3`, from its owner to `0xE9cB1563bE49002383D08386ee287aF7BAD08c3b`, were attempted through `eth_call`; both returned raw error data ending in `0x12`, `MintUpError(18)`.
- The same ownership change for Pass `3` succeeded with Mint Up authorization: `0x2b70fbfd55c3c72745c461c98f3c3b836fefa8140bc0f61b198fa2643f95444d`.
- Private offer creation/replacement: `0xc6808c6b50bbd90a00744c80ccb928f276f85c3a793082bf94833f5c736ab3e4`
- Private resale purchase: `0x915cc57a636bc4827fcfe8c553ddf94dbcad820d5930b07a30eac9783533cf4c`
- Listed price: `1500000`; seller amount: `1365000`; Mint Up fee: `135000`
- Pass `4` ownership moved to the designated buyer and the offer was consumed.

## Collectible metadata

- ERC-165, ERC-721, and ERC-721 Metadata interfaces returned `true`.
- Collection name: `Mint Up Event Pass`; symbol: `MUEP`.
- Metadata purchase: `0xf6bc7febe92be248c4855a51687ef2439d21d22097f85f8c07693584389f3d1c`
- Pass `5` URI: `ipfs://bafkreif4gyq3eohpk4kkzhwv5tjv5bg6xb376eg36rlgwj26lvg73jaxm4`
- `ownerOf(5)` returned the onchain purchaser.
- Metadata and image resolved publicly through `gateway.pinata.cloud`.
- Image CID: `bafybeic3uxaigmw6m26avix2b6mlyvkvlbnpmikggbjaxjkogrrrt3zo7a`
- Arbiscan indexed the deployment as ERC-721 collection `Mint Up Event Pass (MUEP)` and exposed Token ID `5`.

## Remaining coordinated smoke

This evidence validates the deployed contract, not the complete buyer/production domain flow. The browser purchase, email-based recipient resolution, verified Convex reconciliation, transactional email delivery, and manual mobile workflow remain to be executed after deploying the buyer application against this contract.
