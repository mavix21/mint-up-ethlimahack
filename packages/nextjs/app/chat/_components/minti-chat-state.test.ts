import { describe, expect, it } from "vitest";

import {
  getConversationUserId,
  getMessageScrollMetadata,
  hasAssistantMessageAfter,
} from "./minti-chat-state";

describe("getConversationUserId", () => {
  it("keeps the conversation mounted while auth revalidates", () => {
    expect(getConversationUserId(undefined, true, "user-1")).toBe("user-1");
  });

  it("clears the conversation after a settled sign-out", () => {
    expect(getConversationUserId(undefined, false, "user-1")).toBeUndefined();
  });
});

describe("getMessageScrollMetadata", () => {
  it("uses stable message keys and anchors only user turns", () => {
    expect(
      getMessageScrollMetadata({ key: "turn-4-user", role: "user" }),
    ).toEqual({
      messageId: "turn-4-user",
      scrollAnchor: true,
    });
    expect(
      getMessageScrollMetadata({ key: "turn-4-assistant", role: "assistant" }),
    ).toEqual({
      messageId: "turn-4-assistant",
      scrollAnchor: false,
    });
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
