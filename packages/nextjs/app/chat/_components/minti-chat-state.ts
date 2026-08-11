type PositionedMessage = {
  role: string;
  order: number;
  stepOrder: number;
};

type IdentifiedMessage = {
  key: string;
  role: string;
};

export function getMessageScrollMetadata(message: IdentifiedMessage) {
  return {
    messageId: message.key,
    scrollAnchor: message.role === "user",
  };
}

export function getConversationUserId(
  userId: string | undefined,
  isPending: boolean,
  lastSettledUserId: string | undefined,
) {
  return userId ?? (isPending ? lastSettledUserId : undefined);
}

export function hasAssistantMessageAfter(
  messages: PositionedMessage[],
  reference: PositionedMessage | undefined,
) {
  if (!reference) return false;

  return messages.some(
    message =>
      message.role === "assistant" &&
      (message.order > reference.order ||
        (message.order === reference.order &&
          message.stepOrder > reference.stepOrder)),
  );
}
