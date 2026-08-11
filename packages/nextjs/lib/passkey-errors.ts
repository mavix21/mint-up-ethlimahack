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
        "La solicitud de passkey agotó el tiempo de espera. No se realizó ningún cambio. Inténtalo de nuevo cuando quieras.",
      recoverable: true,
      altersAccount: false,
    };
  }
  // locked takes priority (more specific than cancelled)
  if (matches(LOCKED_PATTERNS, combined)) {
    return {
      kind: "locked",
      message:
        "El autenticador está bloqueado después de demasiados intentos. Desbloquea tu dispositivo (biometría/PIN) e inténtalo de nuevo. No se creó ni modificó ninguna cuenta.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (matches(MISSING_CREDENTIAL_PATTERNS, combined)) {
    return {
      kind: "missing_credential",
      message:
        "La credencial seleccionada no está disponible en este autenticador. Usa la passkey sincronizada en su dispositivo original o crea una nueva; la nueva credencial controlará una cuenta diferente y no recuperará la anterior.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (matches(TRANSPORT_PATTERNS, combined)) {
    return {
      kind: "unavailable_transport",
      message:
        "El transporte del autenticador no está disponible (USB/NFC/BLE no conectado o no compatible). Conecta tu llave de seguridad o usa una passkey de plataforma. No se envió nada.",
      recoverable: true,
      altersAccount: false,
    };
  }
  if (matches(UNSUPPORTED_PATTERNS, combined)) {
    return {
      kind: "unsupported",
      message:
        "Este autenticador no creó una passkey ES256 compatible. No se realizó ningún cambio.",
      recoverable: false,
      altersAccount: false,
    };
  }
  if (matches(TIMEOUT_PATTERNS, combined) && lowerName === "notallowederror") {
    return {
      kind: "timeout",
      message:
        "La solicitud de passkey agotó el tiempo de espera. No se envió nada. Tu compra preparada sigue siendo válida hasta que venza; vuelve a intentar la confirmación.",
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
          "La confirmación de la passkey agotó el tiempo de espera. No se realizó ningún cambio. Inténtalo de nuevo cuando quieras.",
        recoverable: true,
        altersAccount: false,
      };
    }
    return {
      kind: "cancelled",
      message: "Se canceló la confirmación de la passkey. No se envió nada.",
      recoverable: true,
      altersAccount: false,
    };
  }
  // InvalidState often missing credential
  if (lowerName === "invalidstateerror") {
    return {
      kind: "missing_credential",
      message:
        "La credencial no está disponible o ya está registrada. No se modificó ninguna cuenta. Si perdiste tu passkey, una nueva creará una cuenta diferente.",
      recoverable: true,
      altersAccount: false,
    };
  }

  // fallback
  const fallbackMsg =
    message && message !== "undefined"
      ? message
      : "La passkey falló. No se realizó ningún cambio.";
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
