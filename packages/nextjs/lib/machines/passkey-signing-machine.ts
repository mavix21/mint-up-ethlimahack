import { assign, fromPromise, setup } from "xstate";

import { classifyPasskeyError, type PasskeyErrorKind } from "../passkey-errors";
import {
  getPasskeyAvailability,
  type PasskeyAvailability,
} from "../passkey-availability";

export type SigningContext = {
  availability: PasskeyAvailability | null;
  errorKind: PasskeyErrorKind | null;
  errorMessage: string | null;
  userOperationHash: string | null;
  transactionHash: string | null;
};

export type SigningEvent =
  | { type: "CHECK_AVAILABILITY" }
  | { type: "SIGN" }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "RESET" };

export const passkeySigningMachine = setup({
  types: {
    context: {} as SigningContext,
    events: {} as SigningEvent,
  },
  actors: {
    checkAvailability: fromPromise(async () => {
      return (await getPasskeyAvailability()) as PasskeyAvailability;
    }),
    performSigning: fromPromise(
      async (): Promise<{
        userOperationHash: string;
        transactionHash?: string;
      }> => {
        throw new Error("performSigning not provided");
      },
    ),
  },
  actions: {
    clearError: assign({
      errorKind: null,
      errorMessage: null,
    }),
    setError: assign({
      errorKind: ({ event }) => {
        // @ts-expect-error
        const err = event.error as unknown;
        return classifyPasskeyError(err).kind;
      },
      errorMessage: ({ event }) => {
        // @ts-expect-error
        const err = event.error as unknown;
        return classifyPasskeyError(err).message;
      },
    }),
  },
  guards: {
    isSupported: ({ context }) =>
      !!context.availability?.supported &&
      context.availability.platformAuthenticatorAvailable !== false,
  },
}).createMachine({
  id: "passkeySigning",
  context: {
    availability: null,
    errorKind: null,
    errorMessage: null,
    userOperationHash: null,
    transactionHash: null,
  },
  initial: "checkingAvailability",
  states: {
    checkingAvailability: {
      invoke: {
        id: "checkAvailability",
        src: "checkAvailability",
        onDone: {
          target: "evaluating",
          actions: assign({
            availability: ({ event }) => event.output as PasskeyAvailability,
          }),
        },
        onError: {
          target: "unavailable",
          actions: assign({
            availability: () => ({
              supported: false,
              platformAuthenticatorAvailable: null,
              conditionalMediationAvailable: null,
              reason: "availability_check_failed",
            }),
            errorMessage: () =>
              "No se pudo comprobar la compatibilidad con passkeys.",
          }),
        },
      },
    },
    evaluating: {
      always: [
        { guard: "isSupported", target: "idle" },
        { target: "unavailable" },
      ],
    },
    unavailable: {
      on: {
        CHECK_AVAILABILITY: { target: "checkingAvailability" },
        RETRY: { target: "checkingAvailability" },
        RESET: {
          target: "checkingAvailability",
          actions: assign({
            errorKind: null,
            errorMessage: null,
            availability: null,
          }),
        },
      },
    },
    idle: {
      on: {
        SIGN: { target: "signing" },
        CHECK_AVAILABILITY: { target: "checkingAvailability" },
      },
    },
    signing: {
      entry: "clearError",
      invoke: {
        id: "performSigning",
        src: "performSigning",
        onDone: {
          target: "signed",
          actions: assign({
            userOperationHash: ({ event }) => event.output.userOperationHash,
            transactionHash: ({ event }) =>
              event.output.transactionHash ?? null,
          }),
        },
        onError: {
          target: "signingError",
          actions: "setError",
        },
      },
      on: { CANCEL: { target: "idle", actions: "clearError" } },
    },
    signingError: {
      on: {
        RETRY: { target: "idle", actions: "clearError" },
        SIGN: { target: "signing" },
        RESET: { target: "idle", actions: "clearError" },
      },
    },
    signed: {
      type: "final",
    },
  },
});
