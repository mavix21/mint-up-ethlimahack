import { assign, fromPromise, setup } from "xstate";

import { classifyPasskeyError, type PasskeyErrorKind } from "../passkey-errors";
import {
  getPasskeyAvailability,
  type PasskeyAvailability,
} from "../passkey-availability";

// Context for registration machine
export type RegistrationContext = {
  availability: PasskeyAvailability | null;
  credentialId: string | null;
  browserAccountAddress: string | null;
  serverAccountAddress: string | null;
  errorKind: PasskeyErrorKind | null;
  errorMessage: string | null;
  // backup eligibility hint from server / authenticator attestation
  backupState: boolean | null;
  isSyncedCredential: boolean | null;
};

export type RegistrationEvent =
  | { type: "CHECK_AVAILABILITY" }
  | { type: "START_REGISTRATION" }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "RESET" };

export const passkeyRegistrationMachine = setup({
  types: {
    context: {} as RegistrationContext,
    events: {} as RegistrationEvent,
  },
  actors: {
    checkAvailability: fromPromise(async () => {
      return (await getPasskeyAvailability()) as PasskeyAvailability;
    }),
    // registration is invoked by the consuming component via a provided actor override
    // default is a no-op; real implementation supplied with .provide()
    performRegistration: fromPromise(
      async (): Promise<{
        credentialId: string;
        browserAddress: string;
        serverAddress: string;
        backupState: boolean | null;
      }> => {
        throw new Error("performRegistration not provided");
      },
    ),
  },
  actions: {
    clearError: assign({
      errorKind: null,
      errorMessage: null,
    }),
  },
  guards: {
    isSupported: ({ context }) =>
      !!context.availability?.supported &&
      context.availability.platformAuthenticatorAvailable !== false,
  },
}).createMachine({
  id: "passkeyRegistration",
  context: {
    availability: null,
    credentialId: null,
    browserAccountAddress: null,
    serverAccountAddress: null,
    errorKind: null,
    errorMessage: null,
    backupState: null,
    isSyncedCredential: null,
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
            availability: (args: any) =>
              (args.event as any).output as PasskeyAvailability,
          }),
        },
        onError: {
          target: "unavailable",
          actions: assign({
            // @ts-ignore xstate type narrow
            availability: () => ({
              supported: false,
              platformAuthenticatorAvailable: null,
              conditionalMediationAvailable: null,
              reason: "availability_check_failed",
            }),
            errorMessage: () => "Could not check passkey capability.",
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
        START_REGISTRATION: { target: "creating" },
        CHECK_AVAILABILITY: { target: "checkingAvailability" },
      },
    },
    creating: {
      entry: "clearError",
      invoke: {
        id: "performRegistration",
        src: "performRegistration",
        onDone: {
          target: "success",
          actions: assign({
            credentialId: (args: any) =>
              (args.event as any).output.credentialId,
            browserAccountAddress: (args: any) =>
              (args.event as any).output.browserAddress,
            serverAccountAddress: (args: any) =>
              (args.event as any).output.serverAddress,
            backupState: (args: any) => (args.event as any).output.backupState,
            isSyncedCredential: (args: any) =>
              (args.event as any).output.backupState,
          }),
        },
        onError: [
          {
            // cancelled/timeout etc remain recoverable, go to error substate
            target: "registrationError",
            actions: assign({
              errorKind: (args: any) =>
                classifyPasskeyError((args.event as any).error).kind,
              errorMessage: (args: any) =>
                classifyPasskeyError((args.event as any).error).message,
            }),
          },
        ],
      },
      on: {
        CANCEL: { target: "idle", actions: "clearError" },
      },
    },
    registrationError: {
      // distinct recoverable states without creating/changing account
      initial: "unknown",
      states: {
        cancelled: {},
        timeout: {},
        locked: {},
        unavailable_transport: {},
        missing_credential: {},
        unsupported: {},
        unknown: {},
      },
      // keep outer context errorKind for UI distinction; inner states are nominal
      on: {
        RETRY: { target: "idle", actions: "clearError" },
        START_REGISTRATION: { target: "creating" },
        RESET: { target: "idle", actions: "clearError" },
        CHECK_AVAILABILITY: { target: "checkingAvailability" },
      },
    },
    success: {
      type: "final",
    },
  },
});

export type PasskeyRegistrationMachine = typeof passkeyRegistrationMachine;
