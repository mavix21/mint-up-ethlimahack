"use client";

import { useState } from "react";
import { authClient } from "~~/lib/auth-client";
import { Button } from "~~/components/ui/button";

export function GoogleSignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    const callbackURL = `${window.location.origin}/auth/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
    if (result.error) {
      setError(result.error.message ?? "Falló el inicio de sesión con Google.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button className="w-full" size="lg" disabled={pending} onClick={signIn}>
        {pending ? "Abriendo Google..." : "Continuar con Google"}
      </Button>
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </div>
  );
}
