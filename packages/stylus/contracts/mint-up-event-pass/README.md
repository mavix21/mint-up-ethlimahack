# Mint Up Event Pass

Minimal paid event-pass contract for Arbitrum Stylus. It deliberately does not
implement ERC-721 approvals, enumeration, metadata, resale, refunds, or token
configuration after deployment.

## Model

- Ownership is one address per global `uint64` pass ID.
- Event IDs are Mint Up supplied `bytes32` values.
- Pass state is `1` (active) or `2` (attended).
- Cancellation invalidates entry without deleting ownership or attendance.
- The administrator is fixed and cannot transfer or check in user passes unless
  explicitly configured as that event's check-in operator.
- USDC is fixed by the constructor and primary-sale funds go directly from the
  buyer to the event revenue recipient.

Arbitrum Sepolia's official Circle USDC address is:

`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

Deploy with constructor arguments `(administrator, usdc, initiallyPaused)`.
Stylus constructors are guarded by the SDK's reserved constructor slot and can
only execute once.

## Error Codes

| Code | Meaning |
| ---: | --- |
| 1 | Unauthorized |
| 2 | Invalid input |
| 3 | Event not found |
| 4 | Event already exists |
| 5 | Event cancelled |
| 6 | Sales disabled |
| 7 | Outside sale window |
| 8 | Sold out |
| 9 | Pass not found |
| 10 | Caller is not pass owner |
| 11 | Transfers disabled |
| 12 | Pass is not active |
| 13 | Pass belongs to another event |
| 14 | USDC payment failed |
| 15 | Contract paused |
| 16 | Reentrant purchase |
| 17 | Pass ID overflow |

## Commands

Run from this directory:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --lib
cargo stylus build
cargo stylus export-abi
cargo run --features export-abi -- constructor
solc --abi --pretty-json --overwrite -o abi abi/IMintUpEventPass.sol
cargo stylus check --endpoint https://sepolia-rollup.arbitrum.io/rpc
```

The complete Solidity interface, including events, is in
`abi/IMintUpEventPass.sol`.

## Local End-to-End Test

From the repository root:

```sh
yarn chain
yarn deploy
yarn test:local
```

`yarn deploy` checks whether the USDC address in
`deployments/412346_local-deps.json` still has bytecode. Nitro DevNode resets
its state when restarted, so if the address is stale the deploy script compiles
and deploys `scripts/local/MockUsdc.sol`, updates the dependency file, and then
deploys Event Pass with the new token address.

`yarn test:local` runs a complete on-chain flow: mint mock USDC, register a live
event, approve USDC, verify sale boundaries and direct payment, transfer and
check in a pass, and exercise cancellation, pause, authorization, errors, and
events. The mock has permissionless minting and is only selected automatically
for chain ID `412346`; it must never be used as a production payment token.

Deploy to Arbitrum Sepolia with:

```sh
cargo stylus deploy \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$ADMIN" 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d false \
  --no-verify
```

This ticket does not deploy to Sepolia. After a later deployment, set the
`ARBITRUM_SEPOLIA_EVENT_PASS` constant in
`packages/nextjs/contracts/eventPassEnvironment.ts` to the deployed address.

## Verified Size

Measured locally with Rust `1.91.0`, `stylus-sdk 0.9.0`, and
`cargo-stylus 0.10.8` against Arbitrum Sepolia:

- Compressed deployment size: 22,832 bytes.
- Decompressed WASM size: 73,572 bytes.
- `cargo stylus check`: passed.
