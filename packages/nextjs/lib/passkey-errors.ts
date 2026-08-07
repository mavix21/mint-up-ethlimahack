/**
 * Classify WebAuthn / passkey errors into distinct, recoverable product states
 * without creating or changing an account association.
 *
 * Covers cancellation, timeout, locked authenticator, unavailable transport,
 * unavailable selected credential, unsupported, and unknown.
 */

export type PasskeyErrorKind =
  | "cancelled"
  | "timeout"
  | "locked"
  | "unavailable_transport"
  | "missing_credential"
  | "unsupported"
  | "unknown";

export type ClassifiedPasskeyError = {
  kind: PasskeyErrorKind;
  message: string;
  recoverable: boolean;
  altersAccount: false;
};

const CANCEL_PATTERNS = [
  /notallowed/i,
  /cancel/i,
  /abort/i,
  /user cancelled/i,
  /operation timed out/i,
];
const TIMEOUT_PATTERNS = [/timed out/i, /timeout/i, /exceeded/i];
const LOCKED_PATTERNS = [
  /locked/i,
  /authenticator.*locked/i,
  /uv.*blocked/i,
  /user verification.*blocked/i,
  /too many attempts/i,
];
const TRANSPORT_PATTERNS = [
  /transport/i,
  /unavailable.*transport/i,
  /authenticator.*not available/i,
  /nfc/i,
  /ble/i,
  /usb/i,
];
const MISSING_CREDENTIAL_PATTERNS = [
  /credential.*not found/i,
  /not recognized/i,
  /invalidstate/i,
  /no credentials/i,
  /credential.*excluded/i,
  /unknown credential/i,
  /allowcredentials/i,
];
const UNSUPPORTED_PATTERNS = [
  /notsupported/i,
  /unsupported/i,
  /publickeycredential.*not/i,
];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some(p => p.test(text));
}

function normalizeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message };
  if (typeof err === "string") return { name: "Error", message: err };
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    const n = (err as { name?: unknown }).name;
    return {
      name: typeof n === "string" ? n : "Error",
      message: typeof m === "string" ? m : String(m),
    };
  }
  return { name: "Error", message: String(err) };
}

export function classifyPasskeyError(error: unknown): ClassifiedPasskeyError {
  const { name, message } = normalizeError(error);
  const combined = `${name}: ${message}`.toLowerCase();
  const lowerMsg = message.toLowerCase();
  const lowerName = name.toLowerCase();

  // Explicit TimeoutError from some browsers
  if (lowerName === "timeouterror") {
    return {
      kind: "timeout",
      message:
        "Passkey request timed out. Nothing was changed. Retry when ready.",
      recoverable: true,
      altersAccount: false,
    };
  }
  // locked takes priority (more specific than cancelled)
  if (matches(LOCKED_PATTERNS, combined)) {
    return {
      kind: "locked",
      message:
        "Authenticator is locked after too many attempts. Unlock your device (biometric/PIN) and try again. No account was created or changed.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (matches(MISSING_CREDENTIAL_PATTERNS, combined)) {
    return {
      kind: "missing_credential",
      message:
        "Selected credential is not available on this authenticator. Use the synced passkey on its original device or create a replacement — a new credential will control a different account and does not recover the previous one.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (matches(TRANSPORT_PATTERNS, combined)) {
    return {
      kind: "unavailable_transport",
      message:
        "Authenticator transport unavailable (USB/NFC/BLE not connected or not supported). Connect your security key or use a platform passkey. Nothing was submitted.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (matches(UNSUPPORTED_PATTERNS, combined)) {
    return {
      kind: "unsupported",
      message:
        "This authenticator did not create a compatible ES256 passkey. Nothing was changed.",
      recoverable: false,
      altersAccount: false,
    };
  }
  if (matches(TIMEOUT_PATTERNS, combined) && lowerName === "notallowederror") {
    return {
      kind: "timeout",
      message:
        "Passkey request timed out. Nothing was submitted. Your prepared purchase remains valid until expiry — retry the confirmation.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (lowerName === "notallowederror" || matches(CANCEL_PATTERNS, combined)) {
    // default NotAllowedError is cancellation unless we matched more specific above
    if (matches(TIMEOUT_PATTERNS, combined)) {
      return {
        kind: "timeout",
        message:
          "Passkey confirmation timed out. Nothing was changed. Retry when ready.",
        recoverable: true,
        altersAccount: false,
      };
    }
    return {
      kind: "cancelled",
      message: "Passkey confirmation was cancelled. Nothing was submitted.",
      recoverable: true,
      altersAccount: false,
    };
  }
  // InvalidState often missing credential
  if (lowerName === "invalidstateerror") {
    return {
      kind: "missing_credential",
      message:
        "Credential unavailable or already registered. No account was changed. If you lost your passkey, a new one will create a different account.",
      recoverable: true,
      altersAccount: false,
    };
  }

  // fallback
  const fallbackMsg =
    message && message !== "undefined"
      ? message
      : "Passkey failed. Nothing was changed.";
  return {
    kind: "unknown",
    message: fallbackMsg,
    recoverable: true,
    altersAccount: false,
  };
}

export function passkeyErrorMessage(error: unknown): string {
  return classifyPasskeyError(error).message;
}

export function isRecoverablePasskeyError(error: unknown): boolean {
  return classifyPasskeyError(error).recoverable;
}

// For tests: ensure the distinction of kinds
export const _testPatterns = {
  CANCEL_PATTERNS,
  TIMEOUT_PATTERNS,
  LOCKED_PATTERNS,
  TRANSPORT_PATTERNS,
  MISSING_CREDENTIAL_PATTERNS,
};
