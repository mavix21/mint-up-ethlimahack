"use client";

export function PasskeyLifecycleGuard({
  accountExists,
}: {
  accountExists: boolean;
}) {
  if (!accountExists) return null;
  return (
    <div className="mt-6 rounded-2xl border bg-card p-4 text-sm leading-6">
      <p className="font-bold">Credential lifecycle</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Deleting or replacing this passkey in your browser will{" "}
          <strong className="text-foreground">not</strong> revoke the onchain
          Kernel owner. The smart account still requires the original credential
          you just used.
        </li>
        <li>
          Data deletion in Mint Up (Convex) does not revoke the onchain signer —
          treat it as app data cleanup, not onchain revocation.
        </li>
        <li>
          Creating a new passkey does{" "}
          <strong className="text-foreground">
            not recover the previous account
          </strong>
          . A replacement credential will derive a{" "}
          <strong className="text-foreground">different address</strong> and
          cannot control the old funded account.
        </li>
        <li>
          Replacement is blocked while the current account may hold assets until
          an approved onchain signer rotation is available.
        </li>
      </ul>
      <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs font-semibold text-amber-700">
        Full onchain signer rotation is a production gate — not approximated by
        Better Auth recovery or a new passkey. See Recovery & Rotation Gate
        below.
      </p>
    </div>
  );
}

export function SyncedVsDeviceBoundNotice({
  backupEligible,
}: {
  backupEligible?: boolean | null;
}) {
  return (
    <aside className="rounded-3xl bg-primary/10 p-6 text-sm leading-6">
      <p className="font-bold">Synced vs device-bound</p>
      {backupEligible === true ? (
        <p className="mt-2">
          This passkey is <strong>synced</strong> (iCloud Keychain / Google
          Password Manager / password manager). Returning on a supported synced
          device reconstructs the same Kernel address without another
          registration — authentication finds the existing synced credential.
        </p>
      ) : backupEligible === false ? (
        <p className="mt-2">
          This passkey appears <strong>device-bound</strong>. It will not
          automatically appear on another device. Mint Up does not promise
          cross-device recovery that the authenticator cannot provide. Losing
          this credential orphans the account until onchain rotation exists.
        </p>
      ) : (
        <p className="mt-2">
          <strong>Returning on another device?</strong> Synced passkeys may be
          available there. Device-bound credentials do not automatically move,
          and creating a replacement does not recover an existing account.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Backup state is reported by the authenticator (backupEligible /
        backupState). Check your OS password manager to verify whether the
        credential is synced.
      </p>
    </aside>
  );
}

export function RotationGateBanner() {
  return (
    <div
      data-testid="rotation-gate"
      className="mt-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
        Production gate — signer rotation
      </p>
      <p className="mt-2 text-sm font-semibold">
        Full onchain Kernel signer rotation is required before production value.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Better Auth recovery and creating a new passkey{" "}
        <strong className="text-foreground">do not</strong> rotate the onchain
        owner. A new credential controls a different address. Approved onchain
        rotation (guardian/multisig/social-recovery) is a separate,
        independently designed mechanism and remains blocked for funded
        accounts.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        This banner is visible on /wallet and after any purchase attempt — it is
        not approximated by Better Auth.
      </p>
    </div>
  );
}
