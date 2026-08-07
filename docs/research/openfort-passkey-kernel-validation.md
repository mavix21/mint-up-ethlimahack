# Openfort to Passkey-Controlled Kernel Validation

**Date:** 2026-08-06  
**Scope:** Mint Up production repository and the experimental Passes repository  
**Decision:** Validation only. No migration code has been implemented.

The primary-source compatibility research supporting this report is in
[`passkey-kernel-primary-sources.md`](./passkey-kernel-primary-sources.md).

## Recommendation

Proceed with an Arbitrum Sepolia MVP using a **separate, wallet-specific
WebAuthn passkey** as the owner of a Kernel ERC-4337 account. Keep Better Auth
as the only application authentication system and require its authenticated
session before wallet-passkey registration, account association, purchase
preparation, sponsorship, submission, or status access.

Do not directly reuse a Better Auth login assertion as a Kernel signature.
Better Auth owns a random login challenge and does not expose a supported
`sign(challenge)` wallet API. Reusing the same credential through a custom
adapter is technically possible, but it would couple authentication and asset
control to unsupported key conversion, algorithm enforcement, counter, RP,
deletion, and recovery behavior. That coupling is not justified for this MVP.

This is a **conditional go for a testnet MVP**, not a production launch:

- **GO:** separate blockchain passkey, pinned Kernel/EntryPoint/validator
  configuration, Permissionless, Pimlico, and Arbitrum Sepolia.
- **NO-GO:** direct Better Auth assertion reuse.
- **NO-GO for production funds:** until signer recovery/rotation, sponsorship
  controls, ERC-4337 receipt reconciliation, real-device coverage, and the
  canonical Event Pass deployment address are proven.

## Current Integration

### Passes frontend

Passes currently has two Openfort client integrations:

- `@openfort/react` `1.0.16` provisions and recovers the embedded wallet in
  `packages/nextjs/components/wallet/openfort-wallet.tsx`.
- `@openfort/openfort-js` `2.1.0` independently initializes and recovers the
  purchase signer in `packages/nextjs/lib/embedded-wallet-client.ts`.

Both authenticate Openfort with a browser-readable Better Auth session token.
The onboarding flow creates or recovers an EOA through Shield, signs a SIWE
linking challenge, and registers the address in the shared Convex deployment.
The purchase flow then recovers that EOA again and sends two ordinary
transactions: exact-price USDC `approve`, followed by Event Pass `purchase`.

Relevant files are:

- `packages/nextjs/components/wallet/openfort-wallet.tsx`
- `packages/nextjs/lib/embedded-wallet-client.ts`
- `packages/nextjs/lib/openfort-browser-config.ts`
- `packages/nextjs/lib/openfort-wallet.ts`
- `packages/nextjs/app/wallet/actions.ts`
- `packages/nextjs/app/api/wallet/recovery/route.ts`
- `packages/nextjs/app/wallet/page.tsx`
- `packages/nextjs/app/passes/[eventId]/page.tsx`
- `packages/nextjs/components/passes/event-pass-purchase.tsx`
- `packages/nextjs/lib/mint-up-wallet-server.ts`
- `packages/nextjs/app/api/wallet/link/route.ts`

`packages/nextjs/package.json` and the lockfile contain the two Openfort client
packages. `packages/nextjs/.env.example` contains their browser and Shield
configuration.

### Mint Up backend

The shared Convex backend is the authority for Better Auth sessions, wallet
association, purchase preparation, and receipt reconciliation:

- `packages/backend/convex/auth.ts` configures Google, password, SIWE, bearer,
  cross-domain, and Convex authentication. It does not configure passkeys.
- `packages/backend/convex/passesIdentity.ts` and
  `passesIdentityActions.ts` provision, recover, and project Openfort wallets.
- `packages/backend/convex/tables/userWallets.ts` stores the embedded-wallet
  projection and provider-specific provisioning data.
- `packages/backend/convex/eventPassPurchases.ts:99-125` refuses purchases
  unless the buyer is a ready `openfort-client` embedded wallet.
- `packages/backend/convex/lib/eventPassPurchaseChain.ts:61-66` assumes a
  direct EOA transaction from the buyer to the Event Pass contract.

The backend also uses Openfort for the **Event Pass administrator account** in
`openfortSetupActions.ts`. That is separate from attendee wallet onboarding.
Replacing attendee wallets does not remove this administrative dependency; it
requires its own custody and contract-administration decision.

## Better Auth Passkey Compatibility

No Mint Up application currently installs `@better-auth/passkey`, calls
`passkey()`/`passkeyClient()`, stores a Better Auth passkey table, or defines an
RP ID. A passkey used by Google to authenticate the Google account is not
exposed through OAuth and cannot be used by Mint Up.

If the Better Auth plugin is added, it can expose the credential ID and stored
COSE public key after verified registration. WebAuthn permits the same
credential to authorize both login and transactions, but each operation needs
a fresh assertion over its own challenge:

- Better Auth generates, stores, verifies, and consumes a random login
  challenge, then creates an application session.
- Kernel must verify an assertion over the finalized ERC-4337 `userOpHash`.
- A Better Auth login assertion cannot be replayed or transformed into that
  Kernel signature.

An adapter could decode Better Auth's COSE key into P-256 coordinates and call
viem's `toWebAuthnAccount`, but Better Auth does not support caller-provided
signing challenges, does not currently expose an ES256-only registration
option, defaults user verification to `preferred`, and has an independent
credential deletion/counter lifecycle. This is feasible only as custom,
version-pinned security code, not a direct supported integration.

**Chosen approach:** leave Better Auth authentication unchanged and register a
second credential specifically for blockchain authorization. Label the setup
as securing Event Passes rather than wallet onboarding.

## Proposed Architecture

### Registration and reconstruction

1. A signed-in user requests wallet-passkey registration options.
2. The server generates a random WebAuthn challenge and stores it in Convex,
   bound to user, ceremony, RP ID, allowed origin, and a short expiry.
3. Registration requests ES256/P-256, discoverability as required by the
   product, and `userVerification: "required"`.
4. The browser invokes WebAuthn in a narrow client component.
5. The server verifies challenge, origin, RP ID, user verification,
   credential ID, algorithm, attestation response, and counter data. A Convex
   mutation atomically consumes the challenge and persists the public
   credential/account association.
6. The server and browser independently reconstruct the Kernel account from
   the same pinned parameters and reject an address mismatch.

The private key remains in the authenticator. Convex stores only public
credential and deterministic account data.

Choose the RP ID before implementation. `passes.mint-up.xyz` gives the
narrowest browser authority if signing remains in Passes. `mint-up.xyz` is
needed only if multiple Mint Up subdomains must invoke the credential. An RP ID
or registrable-domain migration is not transparent wallet recovery.

### Candidate account matrix

Pin this complete candidate matrix for the initial spike:

| Parameter          | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Chain              | Arbitrum Sepolia `421614`                                     |
| EntryPoint         | `0.7`, `0x0000000071727De22E5E9d8BAf0edAc6f37da032`           |
| Kernel             | `0.3.1`                                                       |
| WebAuthn validator | patched `0.0.3`, `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69` |
| Account logic      | `0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D`                  |
| Factory            | `0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419`                  |
| Meta-factory       | `0xd703aaE79538628d27099B8c4f621bE4CCd142d5`                  |
| Meta-factory mode  | `true`, passed explicitly rather than inherited as a default  |
| Account index      | `0`                                                           |
| Nonce key          | `0`                                                           |
| `permissionless`   | candidate `0.3.7`                                             |
| `viem`             | compatible candidate `2.55.11`                                |
| direct `ox` peer   | candidate `0.11.3`                                            |

Pimlico documents Arbitrum Sepolia, EntryPoint `0.7`, and Kernel `0.3.1` as
supported. Live Arbitrum Sepolia RPC checks on the report date returned code at
all five contract addresses above. This validates deployment presence, not a
security audit or permanent compatibility guarantee.

The Passes app's current viem `2.39.0` does not satisfy permissionless `0.3.7`'s
`^2.44.4` peer requirement. The exact dependency matrix must be installed and
tested together. Do not rely on Kernel, factory, validator, EntryPoint,
meta-factory, index, nonce-key, or version defaults.

### Sponsored purchase

The browser reconstructs the account and requests one atomic Kernel batch:

1. `USDC.approve(eventPassAddress, exactPrice)`.
2. `EventPass.purchase(eventIdentifier)`.

Both calls use zero native value and batch execution must revert on failure.
The authoritative price, token, contract, event identifier, and expiry still
come from the existing authenticated purchase preparation flow. Sponsorship
must finish before the passkey signs because paymaster and gas fields are part
of the UserOperation hash.

Permissionless remains in the narrow browser signer/client island. Pages,
purchase data, account lookup, and policy decisions remain server-first.

### Bundler and paymaster boundary

Do not expose an unrestricted Pimlico URL or API key to browser code. Add an
authenticated server proxy or narrow server endpoints and keep these values
server-only:

- `PIMLICO_API_KEY`
- `PIMLICO_SPONSORSHIP_POLICY_ID`
- the fixed chain/EntryPoint configuration

The proxy must allow only required bundler/paymaster RPC methods, validate the
session and associated sender, rate-limit by user/account/IP, cap payload size,
and reject unknown chains and EntryPoints. Before requesting sponsorship, it
must decode the Kernel batch and prove it matches an unexpired purchase owned
by the session:

- exactly the approved USDC and Event Pass contracts;
- exact `approve` and `purchase` selectors and argument values;
- exact-price approval, no unlimited approval;
- zero native value and no extra calls;
- per-user, per-operation, and global count/cost limits.

Use a Pimlico hosted policy for chain and budget limits plus an approval webhook
or the Mint Up proxy for full call-data validation. Do not assume a hosted
spending policy alone enforces contract methods. Restrict Pimlico key features
and origins/IPs as defense in depth.

A bundler or paymaster can censor, delay, or refuse an operation, but cannot
forge the account signature or alter a signed operation. The account and its
assets are not Pimlico-custodied. Another ERC-4337 bundler and paymaster can be
used later if they support this chain, EntryPoint, Kernel, validator, and
simulation profile.

## Convex Changes

Replace provider-specific attendee provisioning with explicit public key and
account configuration records. The minimal model is:

### `walletPasskeyChallenges`

- `userId`, `ceremony`, `challenge`, `rpId`, `origin`, `expiresAt`, `createdAt`.
- Index by challenge and user.
- Generated server-side, short-lived, and atomically deleted/consumed once.

### `walletPasskeyCredentials`

- `userId`, credential ID in canonical base64url form, verified COSE public
  key, uncompressed P-256 key or `x`/`y`, COSE algorithm `-7`, RP ID.
- Transports, counter, AAGUID, device type, backup eligibility/state, label,
  creation time, and lifecycle state.
- Unique credential-to-user association enforced in one Convex mutation.
- No private key, seed, PRF output, or reusable assertion.

### `smartAccountConfigurations`

- `userId`, credential reference, chain ID, checksum account address.
- Account type, Kernel version, EntryPoint version/address, validator
  address/version, account logic, factory, meta-factory, meta-factory mode,
  account index, and nonce key.
- Factory/init-data hash and pinned client-library versions for diagnostics.
- Counterfactual/deployed state and timestamps.
- Unique user/chain and address/chain associations enforced transactionally.

Change `userWallets` from Openfort's `embedded` projection to a provider-neutral
`smartAccount` projection, or make `smartAccountConfigurations` the canonical
wallet source and retain `userWallets` only for externally linked wallets.
Delete `embeddedWalletProvisioning` only after the new flow is verified.

Extend `eventPassPurchases` with `userOperationHash` and the eventual bundler
transaction hash. Add a sponsorship-attempt/audit record keyed by user,
purchase, sender, call-data hash, policy, outcome, and cost estimate.

The Better Auth schema needs no passkey table for the recommended separate
wallet credential. Better Auth continues to own only application identity and
sessions.

## Backend Changes

- Add authenticated begin/complete wallet-passkey registration functions.
- Verify WebAuthn registration server-side and atomically associate one account
  with the current Mint Up user.
- Add authenticated account retrieval containing public reconstruction data.
- Replace the `openfort-client` purchase gate with exact smart-account
  ownership and chain checks.
- Add sponsorship authorization and Pimlico proxy endpoints with method,
  contract, amount, expiry, sender, and rate-limit enforcement.
- Store UserOperation lifecycle separately from the included transaction.
- Update reconciliation for ERC-4337. The included transaction is sent by a
  bundler to EntryPoint, not by the buyer directly to Event Pass. Verify the
  EntryPoint destination and matching successful `UserOperationEvent`, then
  retain the current checks for exactly one matching `EventPassPurchased`, the
  exact USDC transfer, pass owner/state, and preparation expiry.
- Keep the existing cross-domain Better Auth handoff. It already gives Passes a
  host-local session and authenticated Convex token.
- Preserve the administrator Openfort path until its separate replacement is
  designed; removing it is not required for attendee gasless purchases.

## Frontend Changes

- Replace `OpenfortWallet` with one small wallet-passkey activation client
  component under the existing authenticated wallet route.
- Reconstruct `WebAuthnAccount` and Kernel only inside the signing client
  island; pass serializable account/purchase data from Server Components.
- Replace `createEmbeddedWalletClient` with a pinned Permissionless smart
  account client using authenticated bundler/paymaster transports.
- Replace two EOA transactions with one sponsored atomic batch and one biometric
  or PIN prompt.
- Replace Openfort/recovery/wallet-onboarding language with "Secure Event
  Passes" and show the smart-account address only where operationally useful.
- Handle unsupported WebAuthn, cancellation, locked/unavailable authenticators,
  sponsorship denial, dropped UserOperations, timeouts, and retry/status
  recovery without asking for MetaMask, ETH, a seed phrase, or network setup.

## Removal Boundary

After the new test flow is verified, remove from Passes:

- the Openfort client files and recovery route/action listed above;
- Openfort props, provider checks, UI copy, fixtures, and tests;
- `@openfort/react`, `@openfort/openfort-js`, lockfile entries, and browser/Shield
  environment variables;
- `completeClientEmbeddedWallet` and `createWalletRecoverySession` call sites.

Then remove or replace in Mint Up backend:

- attendee Openfort provisioning/recovery branches in `passesIdentity.ts` and
  `passesIdentityActions.ts`;
- the `openfort-client` purchase and event-configuration gates;
- provider-specific attendee schema fields and tests;
- `openfortAuth.ts` and its HTTP route if no Openfort custom-auth flow remains.

Do not remove `@openfort/openfort-node`, administrator configuration, or
`openfortSetupActions.ts` merely because attendee wallets migrated. Those are a
separate dependency until the Event Pass administrator is moved to another
custody model.

## Risks and Blockers

1. **Recovery is the production blocker.** A replacement passkey has a new key
   and normally derives a different account. Better Auth account recovery or
   adding another login passkey does not recover Kernel. Add and test an
   independent on-chain signer rotation/recovery authority before real funds.
2. **Resolve the contract address mismatch.** Passes runtime configuration uses
   an environment-provided Sepolia address while checked-in deployment data
   contains a different address. Sponsorship must allow exactly one canonical
   deployment.
3. **USDC funding is not solved by gas sponsorship.** Users need no ETH, but the
   deterministic account must still receive test USDC before purchase. The MVP
   needs an explicit faucet/distribution path.
4. **ERC-4337 reconciliation must change.** The existing direct EOA sender and
   destination checks reject valid EntryPoint transactions.
5. **The stack is version-sensitive.** Permissionless currently documents
   WebAuthn with Kernel `0.3.1`, while ZeroDev's own newer SDK path targets
   Kernel `0.3.3`. Pin and test one stack rather than combining defaults.
6. **Permissionless's current Kernel WebAuthn encoding does not select the
   native P-256 precompile.** Validation costs are higher and affect sponsor
   limits.
7. **WebAuthn is not transaction display.** The application must display and
   freeze chain, token, spender, amount, contract, and action before prompting.
   Same-origin script compromise remains an account-signing threat.
8. **Credential/RP data is recovery-critical before deployment.** Back up the
   public mapping and configuration; counterfactual accounts cannot be
   reconstructed from a Mint Up user ID alone.
9. **Cross-device support is provider-dependent.** Synced credentials, device-
   bound credentials, security keys, counters, conditional UI, and native app
   behavior require real-device tests.
10. **Pimlico availability is replaceable, not irrelevant.** Switching provider
    preserves the account and assets but still requires compatible bundler
    validation and a new sponsorship integration.

## Phased Plan

1. Pin the package/contract matrix, resolve the Event Pass address, choose the
   RP ID, and add a feature-gated test route with no Openfort onboarding.
2. Implement authenticated, server-challenged, server-verified registration
   and retrieval for a dedicated wallet passkey.
3. Derive the Kernel address independently on server and client, persist every
   reconstruction parameter, and fund the counterfactual address with test
   USDC.
4. Add authenticated Pimlico bundler/paymaster transports, hosted budget policy,
   full call-data validation, rate limits, and audit records.
5. Send one sponsored zero-value test UserOperation and verify counterfactual
   deployment, signing, inclusion, and provider-independent reconstruction.
6. Send the atomic exact-price USDC approval plus Event Pass purchase batch.
7. Update purchase submission/reconciliation for UserOperation and EntryPoint
   semantics, then integrate the existing Mint Up/Passes session handoff.
8. Add policy-denial, simulation, dropped-operation, retry, and unsupported-
   browser handling.
9. Test Apple, Google, Windows, security-key, synced/device-bound, cross-device,
   lost-device, and signer-rotation scenarios. Do not progress to production
   value until recovery succeeds end to end.
10. Remove attendee Openfort glue, dependencies, secrets, schema, and tests only
    after the new path passes the full testnet gate. Handle the administrator
    Openfort account as a separate follow-up.

## Final Decision

The migration is technically viable and materially improves gas and custody
properties for attendees. Implement the Arbitrum Sepolia MVP with a dedicated
blockchain passkey and a pinned Permissionless/Kernel configuration.

Do not force Better Auth passkey reuse, do not expose Pimlico credentials, and
do not represent the flow as production-ready until account recovery and
ERC-4337 reconciliation are complete.
