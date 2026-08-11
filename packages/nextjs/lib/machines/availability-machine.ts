import { assign, fromPromise, setup } from "xstate";

import {
  getPasskeyAvailability,
  type PasskeyAvailability,
} from "../passkey-availability";

export type AvailabilityContext = {
  availability: PasskeyAvailability | null;
  error: string | null;
};

export type AvailabilityEvent = { type: "CHECK" } | { type: "RETRY" };

export const passkeyAvailabilityMachine = setup({
  types: {
    context: {} as AvailabilityContext,
    events: {} as AvailabilityEvent,
  },
  actors: {
    check: fromPromise(async () => {
      return (await getPasskeyAvailability()) as PasskeyAvailability;
    }),
  },
}).createMachine({
  id: "passkeyAvailability",
  context: { availability: null, error: null },
  initial: "checking",
  states: {
    checking: {
      invoke: {
        src: "check",
        onDone: {
          target: "checked",
          actions: assign({
            availability: ({ event }) => event.output as PasskeyAvailability,
            error: null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: () => "La comprobación de disponibilidad falló.",
          }),
        },
      },
    },
    checked: {
      on: {
        CHECK: { target: "checking" },
        RETRY: { target: "checking" },
      },
    },
    failed: {
      on: { RETRY: { target: "checking" }, CHECK: { target: "checking" } },
    },
  },
});
