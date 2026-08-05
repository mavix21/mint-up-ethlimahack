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
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl,
    });
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button className="w-full" size="lg" disabled={pending} onClick={signIn}>
        {pending ? "Opening Google..." : "Continue with Google"}
      </Button>
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </div>
  );
}
