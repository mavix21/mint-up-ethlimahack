import { describe, expect, it } from "vitest";

import {
  getActiveSubmission,
  getConversationUserId,
  getConversationRevision,
  getMessageScrollMetadata,
  hasAssistantMessageAfter,
  selectConversationMessages,
} from "./minti-chat-state";

describe("getActiveSubmission", () => {
  const submission = { userId: "user-1", threadId: "thread-1" };

  it("returns a submission only for its conversation", () => {
    expect(getActiveSubmission(submission, "user-1", "thread-1")).toBe(
      submission,
    );
    expect(getActiveSubmission(submission, "user-1", "thread-2")).toBeNull();
    expect(getActiveSubmission(submission, "user-2", "thread-1")).toBeNull();
  });

  it("supports a lazy new chat before its thread is created", () => {
    const newChatSubmission = { userId: "user-1", threadId: null };

    expect(getActiveSubmission(newChatSubmission, "user-1", null)).toBe(
      newChatSubmission,
    );
    expect(
      getActiveSubmission(newChatSubmission, "user-1", "thread-1"),
    ).toBeNull();
  });
});

describe("getConversationUserId", () => {
  it("keeps the conversation mounted while auth revalidates", () => {
    expect(getConversationUserId(undefined, true, "user-1")).toBe("user-1");
  });

  it("clears the conversation after a settled sign-out", () => {
    expect(getConversationUserId(undefined, false, "user-1")).toBeUndefined();
  });
});

describe("getMessageScrollMetadata", () => {
  it("uses a stable message key", () => {
    expect(getMessageScrollMetadata({ key: "turn-4-user" })).toEqual({
      messageId: "turn-4-user",
    });
  });
});

describe("selectConversationMessages", () => {
  it("keeps the complete transcript while the first page reloads", () => {
    const retained = ["earlier turn", "last complete turn"];
    const partial = ["latest in-flight turn"];

    expect(selectConversationMessages(partial, retained, true)).toBe(retained);
    expect(selectConversationMessages(partial, retained, false)).toBe(partial);
  });
});

describe("getConversationRevision", () => {
  it("is stable across equivalent result arrays", () => {
    const message = {
      key: "turn-1",
      status: "streaming",
      text: "Hello",
      parts: [{ type: "text", text: "Hello", state: "streaming" }],
    };

    expect(getConversationRevision([{ ...message }])).toBe(
      getConversationRevision([{ ...message }]),
    );
  });

  it("changes when streamed content advances", () => {
    const message = {
      key: "turn-1",
      status: "streaming",
      parts: [{ type: "text", state: "streaming" }],
    };

    expect(getConversationRevision([{ ...message, text: "Hello" }])).not.toBe(
      getConversationRevision([{ ...message, text: "Hello there" }]),
    );
  });
});

describe("hasAssistantMessageAfter", () => {
  it("detects an assistant step in the same agent turn", () => {
    const user = { role: "user", order: 4, stepOrder: 0 };
    const messages = [user, { role: "assistant", order: 4, stepOrder: 1 }];

    expect(hasAssistantMessageAfter(messages, user)).toBe(true);
  });

  it("does not treat the user message as an assistant response", () => {
    const user = { role: "user", order: 4, stepOrder: 0 };

    expect(hasAssistantMessageAfter([user], user)).toBe(false);
  });
});
