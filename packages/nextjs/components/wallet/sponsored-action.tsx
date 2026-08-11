"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { abortableWait } from "~~/lib/abortable-wait";
import type { WalletPasskeyAccount } from "~~/lib/kernel-account";
import { reconstructKernelAccount } from "~~/lib/kernel-account";
import {
  getPasskeyAvailability,
  isAvailabilityBlocking,
  type PasskeyAvailability,
} from "~~/lib/passkey-availability";
import { classifyPasskeyError } from "~~/lib/passkey-errors";
import type {
  PrepareUserOperationResult,
  UserOperationStatusResult,
} from "~~/lib/pimlico-user-operation-api";
import { prepareSignAndSubmitUserOperation } from "~~/lib/pimlico-user-operation";
import { resumeOrCreateSponsoredOperation } from "~~/lib/sponsored-operation-flow";
import {
  pollUserOperationStatus,
  StatusRequestError,
} from "~~/lib/user-operation-status-polling";

type State =
  | "idle"
  | "preparing"
  | "biometric"
  | "submitted"
  | "included"
  | "rejected"
  | "failure"
  | "cancelled";

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new StatusRequestError(
      response.status,
      body.message ?? "La acción falló.",
    );
  return body;
}

const MAX_STATUS_ATTEMPTS = 60;

export function SponsoredAction({
  account,
}: {
  account: WalletPasskeyAccount;
}) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>();
  const [userOperationHash, setUserOperationHash] = useState<string>();
  const [transactionHash, setTransactionHash] = useState<string>();
  const [availability, setAvailability] = useState<PasskeyAvailability | null>(
    null,
  );
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const controller = useRef<AbortController>(null);
  const router = useRouter();

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    let cancelled = false;
    void getPasskeyAvailability().then(a => {
      if (!cancelled) {
        setAvailability(a);
        setAvailabilityChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const blocking = availability ? isAvailabilityBlocking(availability) : false;

  async function send() {
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setState("preparing");
    setMessage(undefined);
    setUserOperationHash(undefined);
    setTransactionHash(undefined);
    try {
      const started = await resumeOrCreateSponsoredOperation({
        resume: async () =>
          json(
            await fetch("/api/wallet/user-operation/resume", {
              method: "POST",
              signal,
            }),
          ),
        create: async () => {
          const kernel = await reconstructKernelAccount(account);
          return await prepareSignAndSubmitUserOperation({
            prepare: async () => {
              const prepared = await json<PrepareUserOperationResult>(
                await fetch("/api/wallet/user-operation/prepare", {
                  method: "POST",
                  signal,
                }),
              );
              setState("biometric");
              return prepared;
            },
            signUserOperation: operation =>
              kernel.signUserOperation(operation as never),
            submit: async payload =>
              json<{ userOperationHash: `0x${string}` }>(
                await fetch("/api/wallet/user-operation/submit", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(payload),
                  signal,
                }),
              ),
          });
        },
      });
      setUserOperationHash(started.userOperationHash);

      let result = started.result;
      if (result.status === "pending") {
        setState("submitted");
        result = await pollUserOperationStatus({
          maxAttempts: MAX_STATUS_ATTEMPTS,
          wait: () => abortableWait(2_000, signal),
          fetchStatus: async () =>
            json<UserOperationStatusResult>(
              await fetch("/api/wallet/user-operation/status", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  userOperationHash: started.userOperationHash,
                }),
                signal,
              }),
            ),
        });
      }
      if (result.status === "included") {
        setTransactionHash(result.transactionHash);
        setState("included");
        router.refresh();
      } else {
        setState(result.status === "rejected" ? "rejected" : "failure");
        setMessage(result.message);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      const classified = classifyPasskeyError(error);
      const isCancellationLike =
        classified.kind === "cancelled" ||
        classified.kind === "timeout" ||
        classified.kind === "locked" ||
        classified.kind === "missing_credential" ||
        classified.kind === "unavailable_transport";
      if (isCancellationLike) {
        setState("cancelled");
        setMessage(`${classified.message} No se envió nada.`);
      } else {
        setState(classified.kind === "unsupported" ? "failure" : "failure");
        setMessage(
          classified.message ??
            (error instanceof Error
              ? error.message
              : "La acción patrocinada falló."),
        );
      }
    }
  }

  const busy =
    state === "preparing" || state === "biometric" || state === "submitted";
  const labels: Record<State, string> = {
    idle: "Ejecutar acción aprobada",
    preparing: "Preparando operación patrocinada...",
    biometric: "Confirma con tu passkey...",
    submitted: "Enviada, esperando inclusión...",
    included: "Incluida en Arbitrum Sepolia",
    rejected: "Operación rechazada",
    failure: "La operación falló",
    cancelled: "Confirmación cancelada",
  };

  return (
    <div className="mt-6 border-t border-neutral-content/10 pt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-content/50">
        Acción aprobada
      </p>
      <p className="mt-2 text-sm">
        EntryPoint.balanceOf(account) · 0 ETH · Arbitrum Sepolia
      </p>
      {availabilityChecked && blocking && (
        <div
          role="alert"
          className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm"
        >
          <p className="font-bold">Passkey no disponible</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            WebAuthn no está disponible. Los controles de compra y patrocinio
            están deshabilitados hasta que haya un navegador o autenticador
            compatible. No se modificó ninguna cuenta.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={send}
        disabled={busy || blocking}
        className="mt-4 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-65"
      >
        {blocking ? "Passkey no disponible" : labels[state]}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
      {userOperationHash ? (
        <p className="mt-3 break-all font-mono text-xs">
          UserOperation: {userOperationHash}
        </p>
      ) : null}
      {transactionHash ? (
        <p className="mt-2 break-all font-mono text-xs">
          Transacción: {transactionHash}
        </p>
      ) : null}
    </div>
  );
}
