import { setup } from "xstate";

/**
 * XState machine for the post-purchase success Dialog.
 *
 * Why XState is suitable here:
 * - built-in `after` (delayed transition) handles the ~2s auto-redirect timer without manual setTimeout plumbing
 * - timer is automatically cancelled on user-initiated exit (View passes / close) via state transition
 * - explicit states (`open` → `redirecting`) make the temporal celebration and skip affordance testable with fake timers
 * - consistent with existing `passkey-*` machines already using xstate in this codebase
 *
 * Behaviour:
 * - starts `open`; after ~2000ms transitions to `redirecting` (auto-redirect to My Passes)
 * - `VIEW_PASSES`, `DISMISS`, or `CLOSE` immediately transitions to `redirecting` (skip affordance)
 */
export type SuccessDialogEvent =
  { type: "VIEW_PASSES" } | { type: "DISMISS" } | { type: "CLOSE" };

export const successDialogMachine = setup({
  types: {
    events: {} as SuccessDialogEvent,
  },
}).createMachine({
  id: "successDialog",
  initial: "open",
  states: {
    open: {
      after: {
        // ~2 seconds per spec: auto-redirect to My Passes
        2000: { target: "redirecting" },
      },
      on: {
        VIEW_PASSES: { target: "redirecting" },
        DISMISS: { target: "redirecting" },
        CLOSE: { target: "redirecting" },
      },
    },
    redirecting: {
      type: "final",
    },
  },
});

export type SuccessDialogMachine = typeof successDialogMachine;
