/**
 * WebAuthn / passkey capability detection.
 * Used before presenting activation or purchase controls that require a WebAuthn ceremony.
 * Pure, deterministic helpers — no side effects besides reading window.PublicKeyCredential.
 */

export type PasskeyAvailability = {
  supported: boolean;
  platformAuthenticatorAvailable: boolean | null;
  conditionalMediationAvailable: boolean | null;
  reason: string | null;
};

export type CapabilityDetail = {
  available: PasskeyAvailability;
  requiresUserVerification: boolean;
  canCreatePasskey: boolean;
};

export function isWebAuthnSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.PublicKeyCredential !== "undefined";
}

export async function isPlatformAuthenticatorAvailable(): Promise<
  boolean | null
> {
  if (typeof window === "undefined") return null;
  const cred = window.PublicKeyCredential as unknown as {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };
  if (typeof cred?.isUserVerifyingPlatformAuthenticatorAvailable !== "function")
    return null;
  try {
    return await cred.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return null;
  }
}

export async function isConditionalMediationAvailable(): Promise<
  boolean | null
> {
  if (typeof window === "undefined") return null;
  const cred = window.PublicKeyCredential as unknown as {
    isConditionalMediationAvailable?: () => Promise<boolean>;
  };
  if (typeof cred?.isConditionalMediationAvailable !== "function") return null;
  try {
    return await cred.isConditionalMediationAvailable();
  } catch {
    return null;
  }
}

export async function getPasskeyAvailability(): Promise<PasskeyAvailability> {
  if (!isWebAuthnSupported()) {
    return {
      supported: false,
      platformAuthenticatorAvailable: null,
      conditionalMediationAvailable: null,
      reason: "unsupported_browser",
    };
  }
  const [platform, conditional] = await Promise.all([
    isPlatformAuthenticatorAvailable(),
    isConditionalMediationAvailable(),
  ]);
  // If platform check returns false, authenticator unavailable
  if (platform === false) {
    return {
      supported: true,
      platformAuthenticatorAvailable: false,
      conditionalMediationAvailable: conditional,
      reason: "platform_authenticator_unavailable",
    };
  }
  return {
    supported: true,
    platformAuthenticatorAvailable: platform,
    conditionalMediationAvailable: conditional,
    reason: null,
  };
}

export function availabilityMessage(availability: PasskeyAvailability): string {
  if (!availability.supported)
    return "Passkeys are not supported in this browser. Use a modern Chromium, Safari, or Firefox on a supported OS.";
  if (availability.platformAuthenticatorAvailable === false)
    return "No platform authenticator is available on this device. Enable biometrics/PIN or use a security key.";
  return "Passkey available.";
}

export function isAvailabilityBlocking(
  availability: PasskeyAvailability,
): boolean {
  return (
    !availability.supported ||
    availability.platformAuthenticatorAvailable === false
  );
}
