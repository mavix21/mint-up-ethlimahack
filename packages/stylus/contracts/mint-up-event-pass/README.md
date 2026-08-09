# Mint Up Event Pass

Paid Event Pass contract for Arbitrum Stylus. Each acquired Event Pass is an
ERC-721 collectible backed by OpenZeppelin Stylus, with immutable per-Event
IPFS metadata. The collectible remains visible to wallets and indexers but
cannot be approved, transferred, or sold outside Mint Up. ERC-721 enumeration,
resale, refunds, and mutable metadata are not implemented.

## Model

- OpenZeppelin ERC-721 is the sole ownership ledger. Standard approval and
  transfer calls remain ABI-compatible but always revert with policy error 18.
- The ERC-721 collection is named `Mint Up Event Pass` with symbol `MUEP`.
- Each global `uint64` Pass ID is also its ERC-721 token ID.
- Event IDs are Mint Up supplied `bytes32` values.
- Event registration requires an `ipfs://` metadata URI with a valid CID. The
  URI is captured for each Event Pass when it is acquired and cannot be changed.
- Pass state is `1` (active) or `2` (attended).
- Cancellation invalidates entry without deleting ownership or attendance.
- The administrator is fixed and cannot transfer or check in user passes unless
  explicitly configured as that event's check-in operator.
- USDC is fixed by the constructor and primary-sale funds go directly from the
  buyer to the event revenue recipient.

Arbitrum Sepolia's official Circle USDC address is:

`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

Deploy with constructor arguments
`(administrator, usdc, authorizationSigner, initiallyPaused)`. The immutable
Mint Up signer must be nonzero and distinct from the administrator and USDC.
Stylus constructors are guarded by the SDK's reserved constructor slot and can
only execute once.

The collection supports ERC-165, ERC-721, and ERC-721 Metadata. Standard
ownership and metadata reads remain available. Approvals, marketplace
operators, `transferFrom`, and both `safeTransferFrom` overloads cannot move an
Event Pass. `transferPass` requires an exact, short-lived EIP-712 authorization
from Mint Up in addition to a call by the current owner. The authorization
binds the operation, caller, Pass ID, recipient, amount, nonce, issuance time,
deadline, chain, and contract. The signed issuance/deadline interval cannot
exceed five minutes and each nonce is single-use. Every successful transfer emits the
standard `Transfer`, `EventPassTransferred`, and `MintUpAuthorizationUsed`
events. Event cancellation, disabled transfers, check-in, and emergency pause
remain enforced.

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
| 18 | Movement is restricted to an authorized Mint Up operation |
| 19 | Invalid Mint Up authorization |
| 20 | Mint Up authorization expired |
| 21 | Mint Up authorization nonce already used |

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
  --constructor-args "$ADMIN" 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d "$AUTHORIZATION_SIGNER" false \
  --no-verify
```

This ticket does not deploy to Sepolia. After a later deployment, set the
`ARBITRUM_SEPOLIA_EVENT_PASS` constant in
`packages/nextjs/contracts/eventPassEnvironment.ts` to the deployed address.
