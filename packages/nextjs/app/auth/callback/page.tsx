import { Suspense } from "react";
import { OAuthCallback } from "~~/components/auth/oauth-callback";

export default function AuthCallbackPage() {
  return (
    <main className="grid min-h-[70svh] place-items-center px-6">
      <Suspense
        fallback={
          <p className="text-base-content/70">
            Preparando el inicio de sesión...
          </p>
        }
      >
        <OAuthCallback />
      </Suspense>
    </main>
  );
}
