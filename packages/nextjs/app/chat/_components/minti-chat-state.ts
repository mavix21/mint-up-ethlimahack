type PositionedMessage = {
  role: string;
  order: number;
  stepOrder: number;
};

type IdentifiedMessage = {
  key: string;
};

export function getMessageScrollMetadata(message: IdentifiedMessage) {
  return { messageId: message.key };
}

export function getConversationUserId(
  userId: string | undefined,
  isPending: boolean,
  lastSettledUserId: string | undefined,
) {
  return userId ?? (isPending ? lastSettledUserId : undefined);
}

export function selectConversationMessages<T>(
  messages: T[],
  retainedMessages: T[],
  loadingFirstPage: boolean,
) {
  return loadingFirstPage ? retainedMessages : messages;
}

type RevisionMessage = {
  key: string;
  status: string;
  text: string;
  parts: { type: string; state?: unknown; text?: unknown }[];
};

export function getConversationRevision(messages: RevisionMessage[]) {
  return messages
    .map(message => {
      const parts = message.parts
        .map(part => {
          const state = typeof part.state === "string" ? part.state : "";
          const textLength =
            typeof part.text === "string" ? part.text.length : "";
          return `${part.type}:${state}:${textLength}`;
        })
        .join(",");

      return `${message.key}:${message.status}:${message.text.length}:${parts}`;
    })
    .join("|");
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
