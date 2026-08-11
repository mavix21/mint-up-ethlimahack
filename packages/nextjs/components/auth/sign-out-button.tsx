"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "~~/lib/auth-client";
import { Button } from "~~/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const result = await authClient.signOut();
    if (result.error) {
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" disabled={pending} onClick={signOut}>
      {pending ? "Cerrando sesión..." : "Cerrar sesión"}
    </Button>
  );
}
