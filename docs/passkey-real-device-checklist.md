# Passkey Real-Device Checklist — Mint Up (Issue #19)

> Automated browser tests with virtual authenticators cover supported/unsupported/cancelled/missing/replacement paths (see `tests/e2e/passkey-availability.spec.ts`). This document is the **real-device** complement: Apple, Google, Windows, and a cross-platform security key.

Test on Arbitrum Sepolia `421614` with the pinned Kernel matrix (`permissionless 0.3.7 / Kernel 0.3.1 / validator 0.0.3`).

## Preconditions
- User has a valid Better Auth session (Google OAuth).
- `/wallet` shows **Secure Event Passes** when no account exists; shows the deterministic address after securing.
- Convex stores only verified public credential data — never private key/assertion/Pimlico secrets.

---

## 1. Apple — iCloud Keychain / Passkeys (macOS + iOS)

| Step | Expected |
|------|----------|
| A. Create on macOS Safari with Touch ID | Prompt appears, ES256/P-256, `requiresUserVerification: true`. Success persists same address after reload. |
| B. Cancel at Touch ID prompt | State `cancelled`: “Passkey confirmation was cancelled. Nothing was submitted.” Prepared purchase (if any) safe to retry. No account created/changed. |
| C. Timeout (leave prompt idle >60s) | State `timeout` distinct from cancelled: “Request timed out. Nothing was submitted…” Recoverable. |
| D. Return on iPhone with same Apple ID (synced) | **Same address** reconstructs without another registration — demonstrates synced credential continuity. |
| E. Device-bound note | Label synced as `backupEligible: true` (iCloud). Explain that deleting the credential rotates ≠ onchain owner. |

## 2. Google — Password Manager (Android + Chrome)

| Step | Expected |
|------|----------|
| A. Create on Chrome Android (fingerprint) | Success, `backupState` indicates synced via GPM. |
| B. Locked authenticator (too many attempts) | State `locked`: “Authenticator is locked after too many attempts. Unlock your device and try again.” Recoverable, no submission. |
| C. Cross-device: open on Chrome macOS with same Google account | Synced passkey available there — same address, no second `begin/complete` needed. |
| D. Unavailable transport (USB key unplugged) | If GPM key not available, `unavailable_transport`: “transport unavailable … Connect your security key … Nothing was submitted.” |

## 3. Windows — Windows Hello (Edge / Chrome on Windows 11)

| Step | Expected |
|------|----------|
| A. Create with Windows Hello PIN/biometric | Requires user verification, ES256. Account counterfactual on `421614`. |
| B. Device-bound vs synced | Windows Hello passkeys are often **device-bound** (`backupEligible: false`). UI must state: “Device-bound credentials do not automatically move, and creating a replacement does not recover an existing account.” Verified in `/wallet` `SyncedVsDeviceBoundNotice`. |
| C. Unavailable selected credential (choose non-existent allowCredentials) | `missing_credential`: “Selected credential is not available on this authenticator… A new credential will control a different account.” Distinct from cancelled. |
| D. Unsupported browser check (IE/old Edge) | Before any activation/purchase control, `Passkey not available` gate blocks preparation. Message includes “Unsupported browsers…” with actionable guidance. |

## 4. Cross-platform security key (YubiKey / Titan — USB/NFC/BLE)

| Step | Expected |
|------|----------|
| A. Create with cross-platform key (user verification PIN) | Works when `transport` includes `usb`/`nfc`/`ble`/`hybrid`. |
| B. Key unplugged → transport unavailable | `unavailable_transport` distinct from timeout. Controls disabled before ceremony where possible. |
| C. Present another key (wrong credential) | `missing_credential` — no recovery of old address. New key would create **different** Kernel address. Product never claims otherwise. |
| D. Confirm purchase flow: sponsorship → signing → inclusion | Sign after gas/paymaster fields finalized; mutation invalidates; atomic batch `approve(exactPrice)+purchase`. |

---

## 5. Credential Lifecycle & Production Gate (all platforms)

- [ ] **Returning session**: Close browser, reopen, visit `/wallet` or `/passes/[eventId]` — address unchanged, no second registration prompt (where platform makes synced credential available).
- [ ] **Replacement does not recover**: Create a second passkey for same user (if allowed via direct Convex call) — server would reject or create different address; UI shows “New passkey ≠ recovery of this account — different address. Replacement is blocked while account may hold assets.”
- [ ] **Deletion ≠ onchain revocation**: Deleting credential in OS settings / Convex `delete` action removes app data only. Message: “Data deletion does not revoke the onchain Kernel owner.” Backend deletion must never claim to revoke the validator owner.
- [ ] **Rotation gate visible**: `RotationGateBanner` on `/wallet` (both before and after securing) and implicitly during purchase: “Full onchain signer rotation is a production gate — not approximated by Better Auth recovery or a new passkey.” Verified via `data-testid="rotation-gate"`.

## 6. Unsupported / Degraded Paths

- [ ] Safari incognito with passkeys disabled, Firefox without webauthn, old Chromium: activation and **Review purchase** buttons disabled before preparation, showing “Passkey not available — purchase disabled… no account was created or changed.”
- [ ] `NotAllowedError` name check is not the only discriminator — locked/timeout/transport/missing are each verified via `classifyPasskeyError`.

## Sign-off

Record: device OS/browser version, authenticator AAGUID, `backupEligible`/`backupState`, result per row (pass/fail), hashes of UserOperation/transaction when included, and final `Issued Event Ticket` reconciliation (`UserOperationEvent` + transfer verification).

**Production launch remains blocked** on an independently designed & tested Kernel signer rotation mechanism — this checklist plus virtual-authenticator e2e remain the evidence before that gate.

