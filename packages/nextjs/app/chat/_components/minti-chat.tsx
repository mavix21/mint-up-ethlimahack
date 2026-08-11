"use client";

import { Component, useEffectEvent, useLayoutEffect, useState } from "react";
import Image from "next/image";
import { useSmoothText, useUIMessages } from "@convex-dev/agent/react";
import { useAction, useMutation } from "convex/react";
import {
  ArrowUpIcon,
  CheckIcon,
  LoaderCircleIcon,
  SearchIcon,
} from "lucide-react";

import { Bubble, BubbleContent } from "~~/components/ui/bubble";
import { GoogleSignInButton } from "~~/components/auth/google-sign-in-button";
import { Button } from "~~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~~/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "~~/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "~~/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "~~/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "~~/components/ui/message-scroller";
import { authClient } from "~~/lib/auth-client";
import { mintUpApi, type MintiMessage } from "~~/lib/mint-up-api";
import { EventRecommendationCard } from "./event-recommendation-card";
import {
  getConversationUserId,
  getConversationRevision,
  getMessageScrollMetadata,
  hasAssistantMessageAfter,
  selectConversationMessages,
} from "./minti-chat-state";

const THREAD_STORAGE_PREFIX = "mint-up:minti-thread:";

function readSavedThread(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function saveThread(storageKey: string, threadId: string) {
  try {
    window.localStorage.setItem(storageKey, threadId);
  } catch {
    // The active in-memory thread still works when storage is unavailable.
  }
}

function removeSavedThread(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // A replacement in-memory thread can still be created.
  }
}

function MintiAvatar() {
  return (
    <div
      aria-hidden="true"
      className="size-10 shrink-0 self-start rounded-xl bg-primary/15 p-1 shadow-sm ring-4 ring-background"
    >
      <Image
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="size-full object-contain"
      />
    </div>
  );
}

function AssistantText({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [visibleText] = useSmoothText(text, {
    startStreaming: streaming,
  });

  return <>{visibleText}</>;
}

function UserBubble({ text }: { text: string }) {
  return (
    <Bubble variant="secondary">
      <BubbleContent className="rounded-[1.35rem] rounded-br-md bg-foreground px-4 py-3 text-background dark:bg-foreground dark:text-background">
        {text}
      </BubbleContent>
    </Bubble>
  );
}

function AssistantActivity({
  label,
  searching = false,
}: {
  label: string;
  searching?: boolean;
}) {
  return (
    <Marker role="status" aria-live="polite" className="w-fit text-xs">
      <MarkerIcon>
        {searching ? (
          <SearchIcon />
        ) : (
          <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
        )}
      </MarkerIcon>
      <MarkerContent className="shimmer">{label}</MarkerContent>
    </Marker>
  );
}

function getAssistantActivity(message: MintiMessage) {
  if (
    message.role === "user" ||
    message.text ||
    (message.status !== "pending" && message.status !== "streaming")
  ) {
    return null;
  }

  const searchPart = message.parts.find(
    part => part.type === "tool-searchEvents",
  );

  if (!searchPart) return { label: "Thinking...", searching: false };

  switch (searchPart.state) {
    case "input-streaming":
      return { label: "Preparing an event search...", searching: true };
    case "input-available":
      return { label: "Searching the current event index...", searching: true };
    case "output-available":
      return { label: "Reviewing the matching events...", searching: true };
    case "output-error":
      return { label: "Handling the search error...", searching: false };
  }
}

function SearchEventsPart({
  part,
}: {
  part: Extract<MintiMessage["parts"][number], { type: "tool-searchEvents" }>;
}) {
  if (part.state === "output-error") {
    return (
      <p role="status" className="mx-auto max-w-3xl text-sm text-destructive">
        Event search failed. Try rephrasing your request.
      </p>
    );
  }

  if (part.state !== "output-available") return null;

  const { events, unresolvedFilters } = part.output;

  return (
    <div className="mx-auto max-w-5xl pl-0 sm:pl-10">
      <Marker variant="separator" className="mb-5 text-xs">
        <MarkerIcon>
          <SearchIcon />
        </MarkerIcon>
        <MarkerContent>
          {events.length === 0
            ? "No matching events found"
            : `${events.length} event${events.length === 1 ? "" : "s"} found`}
        </MarkerContent>
      </Marker>
      {unresolvedFilters.length > 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          I could not resolve: {unresolvedFilters.join(", ")}.
        </p>
      ) : null}
      {events.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map(event => (
            <EventRecommendationCard key={event.eventId} event={event} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatMessage({ message }: { message: MintiMessage }) {
  const isUser = message.role === "user";
  const activity = getAssistantActivity(message);

  return (
    <MessageScrollerItem {...getMessageScrollMetadata(message)}>
      <div className="grid gap-5">
        <Message align={isUser ? "end" : "start"} className="mx-auto max-w-3xl">
          {isUser ? null : <MintiAvatar />}
          <MessageContent>
            {isUser ? null : (
              <MessageHeader className="gap-2 px-0 text-foreground">
                <span>Minti</span>
                <span className="size-1 rounded-full bg-primary" />
                <span className="font-normal text-muted-foreground">
                  Event assistant
                </span>
              </MessageHeader>
            )}
            {isUser ? (
              message.parts.map((part, index) =>
                part.type === "text" && part.text ? (
                  <UserBubble
                    key={`${message.key}-text-${index}`}
                    text={part.text}
                  />
                ) : null,
              )
            ) : message.text ? (
              <Bubble key={`${message.key}-text`} variant="ghost">
                <BubbleContent className="max-w-2xl whitespace-pre-wrap text-[15px] leading-7">
                  <AssistantText
                    text={message.text}
                    streaming={message.status === "streaming"}
                  />
                </BubbleContent>
              </Bubble>
            ) : null}
            {activity ? (
              <AssistantActivity
                label={activity.label}
                searching={activity.searching}
              />
            ) : null}
            {!isUser && message.status === "success" ? (
              <MessageFooter className="mt-0.5 gap-1.5 px-0">
                <CheckIcon className="size-3" />
                Response complete
              </MessageFooter>
            ) : null}
          </MessageContent>
        </Message>

        {message.parts.map(part =>
          part.type === "tool-searchEvents" ? (
            <SearchEventsPart key={part.toolCallId} part={part} />
          ) : null,
        )}
      </div>
    </MessageScrollerItem>
  );
}

function PendingUserMessage({
  submissionId,
  prompt,
}: {
  submissionId: string;
  prompt: string;
}) {
  return (
    <MessageScrollerItem messageId={`pending-user-${submissionId}`}>
      <Message align="end" className="mx-auto max-w-3xl">
        <MessageContent>
          <UserBubble text={prompt} />
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

function PendingAssistantMessage({ submissionId }: { submissionId: string }) {
  return (
    <MessageScrollerItem messageId={`pending-assistant-${submissionId}`}>
      <Message className="mx-auto max-w-3xl">
        <MintiAvatar />
        <MessageContent>
          <MessageHeader className="gap-2 px-0 text-foreground">
            <span>Minti</span>
            <span className="size-1 rounded-full bg-primary" />
            <span className="font-normal text-muted-foreground">
              Event assistant
            </span>
          </MessageHeader>
          <AssistantActivity label="Thinking..." />
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

function findPendingUser(messages: MintiMessage[], pending: PendingSubmission) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.role === "user" &&
      message.text === pending.prompt &&
      message._creationTime >= pending.createdAt - 60_000
    ) {
      return message;
    }
  }

  return undefined;
}

function RestoreConversationEnd({ ready }: { ready: boolean }) {
  const { scrollToEnd } = useMessageScroller();
  const scrollToLatest = useEffectEvent(() => {
    scrollToEnd({ behavior: "auto" });
  });

  useLayoutEffect(() => {
    if (ready) scrollToLatest();
  }, [ready]);

  return null;
}

function FocusPendingTurn({ submissionId }: { submissionId: string | null }) {
  const { scrollToMessage } = useMessageScroller();
  const focusTurn = useEffectEvent((id: string) => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    scrollToMessage(`pending-user-${id}`, { behavior });
  });

  useLayoutEffect(() => {
    if (submissionId) focusTurn(submissionId);
  }, [submissionId]);

  return null;
}

function Conversation({
  threadId,
  welcome,
  pending,
}: {
  threadId: string;
  welcome: React.ReactNode;
  pending: PendingSubmission | null;
}) {
  const {
    loadMore,
    results: queriedResults,
    status,
  } = useUIMessages(
    mintUpApi.minti.listMessages,
    { threadId },
    { initialNumItems: 30, stream: true },
  );
  const loadingFirstPage = status === "LoadingFirstPage";
  const queriedRevision = getConversationRevision(queriedResults);
  const [retained, setRetained] = useState<{
    results: MintiMessage[];
    revision: string;
  }>({ results: [], revision: "" });
  if (!loadingFirstPage && retained.revision !== queriedRevision) {
    setRetained({ results: queriedResults, revision: queriedRevision });
  }

  const results = selectConversationMessages(
    queriedResults,
    retained.results,
    loadingFirstPage,
  );
  const pendingUser = pending ? findPendingUser(results, pending) : undefined;
  const assistantStarted = hasAssistantMessageAfter(results, pendingUser);

  return (
    <MessageScrollerProvider defaultScrollPosition="end" scrollMargin={64}>
      <MessageScroller>
        <MessageScrollerViewport className="[overflow-anchor:none]">
          <MessageScrollerContent className="mx-auto w-full max-w-5xl gap-7 px-4 py-8 sm:px-8 sm:py-10">
            {status === "CanLoadMore" ? (
              <MessageScrollerItem className="text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadMore(30)}
                >
                  Load earlier messages
                </Button>
              </MessageScrollerItem>
            ) : null}
            {results.length === 0 && !pending && !loadingFirstPage ? (
              <MessageScrollerItem>{welcome}</MessageScrollerItem>
            ) : null}
            {results.map(message => (
              <ChatMessage key={message.key} message={message} />
            ))}
            {pending && !pendingUser ? (
              <PendingUserMessage
                submissionId={pending.id}
                prompt={pending.prompt}
              />
            ) : null}
            {pending && !assistantStarted ? (
              <PendingAssistantMessage submissionId={pending.id} />
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="bottom-5 shadow-md" />
      </MessageScroller>
      <RestoreConversationEnd ready={!loadingFirstPage} />
      <FocusPendingTurn submissionId={pending?.id ?? null} />
    </MessageScrollerProvider>
  );
}

function StaticConversation({
  children,
  pending,
}: {
  children?: React.ReactNode;
  pending?: PendingSubmission | null;
}) {
  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-5xl gap-7 px-4 py-8 sm:px-8 sm:py-10">
            {children && !pending ? (
              <MessageScrollerItem>{children}</MessageScrollerItem>
            ) : null}
            {pending ? (
              <PendingUserMessage
                submissionId={pending.id}
                prompt={pending.prompt}
              />
            ) : null}
            {pending ? (
              <PendingAssistantMessage submissionId={pending.id} />
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

type ActiveThread = {
  userId: string;
  threadId: string;
};

type PendingSubmission = {
  id: string;
  userId: string;
  prompt: string;
  createdAt: number;
};

function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to ask Minti</DialogTitle>
          <DialogDescription>
            Your message is ready. Sign in to start the conversation.
          </DialogDescription>
        </DialogHeader>
        <GoogleSignInButton callbackUrl="/chat" />
      </DialogContent>
    </Dialog>
  );
}

function Composer({
  userId,
  thread,
  onThreadReady,
  onSubmissionStart,
  onSubmissionError,
}: {
  userId: string | undefined;
  thread: ActiveThread | null;
  onThreadReady: (thread: ActiveThread) => void;
  onSubmissionStart: (submission: PendingSubmission) => void;
  onSubmissionError: (submissionId: string) => void;
}) {
  const createThread = useMutation(mintUpApi.minti.createThread);
  const sendMessage = useAction(mintUpApi.minti.sendMessage);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isSending) return;

    setError(null);
    if (!userId) {
      setIsLoginOpen(true);
      return;
    }

    const submission = {
      id: crypto.randomUUID(),
      userId,
      prompt: nextPrompt,
      createdAt: Date.now(),
    };
    setIsSending(true);
    setPrompt("");
    onSubmissionStart(submission);

    try {
      const storageKey = `${THREAD_STORAGE_PREFIX}${userId}`;
      let threadId = thread?.userId === userId ? thread.threadId : null;
      threadId ??= readSavedThread(storageKey);

      if (!threadId) {
        threadId = await createThread({});
        saveThread(storageKey, threadId);
      }

      onThreadReady({ userId, threadId });
      await sendMessage({ threadId, prompt: nextPrompt });
    } catch {
      onSubmissionError(submission.id);
      setError(
        "Minti could not complete that response. Check the conversation before retrying.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <div className="relative z-10 border-t bg-background/85 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        <form
          className="mx-auto max-w-3xl"
          aria-label="Ask Minti"
          onSubmit={submit}
        >
          <InputGroup className="min-h-14 rounded-2xl border-border bg-background shadow-[0_1px_2px_oklch(0_0_0/0.05),0_8px_30px_oklch(0_0_0/0.06)] has-[textarea]:rounded-2xl">
            <InputGroupTextarea
              aria-label="Message Minti"
              placeholder="Ask about events, people, places, or your budget..."
              className="max-h-32 min-h-12 py-3.5 text-sm"
              rows={1}
              value={prompt}
              disabled={isSending}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={event => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <InputGroupAddon
              align="block-end"
              className="justify-end px-2.5 pb-2"
            >
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="default"
                aria-label="Send message"
                disabled={!prompt.trim() || isSending}
                className="bg-foreground text-background hover:bg-foreground/85"
              >
                {isSending ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <ArrowUpIcon />
                )}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {error ? (
            <p
              role="alert"
              className="mt-2 text-center text-xs text-destructive"
            >
              {error}
            </p>
          ) : (
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Minti can make mistakes. Confirm event details on the event page.
            </p>
          )}
        </form>
      </div>
      <LoginDialog open={isLoginOpen} onOpenChange={setIsLoginOpen} />
    </>
  );
}

class ThreadErrorBoundary extends Component<
  { children: React.ReactNode; onReset: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        role="alert"
        className="grid size-full place-items-center p-8 text-center"
      >
        <div>
          <p className="font-medium">
            This conversation is no longer available.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={this.props.onReset}
          >
            Start a new conversation
          </Button>
        </div>
      </div>
    );
  }
}

function AuthenticatedConversation({
  userId,
  thread,
  welcome,
  pending,
  onThreadReset,
}: {
  userId: string;
  thread: ActiveThread | null;
  welcome: React.ReactNode;
  pending: PendingSubmission | null;
  onThreadReset: () => void;
}) {
  const [savedThreadId, setSavedThreadId] = useState(() =>
    readSavedThread(`${THREAD_STORAGE_PREFIX}${userId}`),
  );
  const threadId = thread?.threadId ?? savedThreadId;

  if (!threadId) {
    return <StaticConversation pending={pending}>{welcome}</StaticConversation>;
  }

  return (
    <ThreadErrorBoundary
      key={threadId}
      onReset={() => {
        removeSavedThread(`${THREAD_STORAGE_PREFIX}${userId}`);
        setSavedThreadId(null);
        onThreadReset();
      }}
    >
      <Conversation threadId={threadId} welcome={welcome} pending={pending} />
    </ThreadErrorBoundary>
  );
}

export function MintiChat({ welcome }: { welcome: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [thread, setThread] = useState<ActiveThread | null>(null);
  const [pendingSubmission, setPendingSubmission] =
    useState<PendingSubmission | null>(null);
  const userId = session?.user.id;
  const [lastSettledUserId, setLastSettledUserId] = useState(userId);
  if (!isPending && lastSettledUserId !== userId) {
    setLastSettledUserId(userId);
  }
  const conversationUserId = getConversationUserId(
    userId,
    isPending,
    lastSettledUserId,
  );
  const activeThread = thread?.userId === conversationUserId ? thread : null;
  const activeSubmission =
    pendingSubmission?.userId === conversationUserId ? pendingSubmission : null;

  return (
    <>
      <div className="min-h-0 flex-1">
        {conversationUserId ? (
          <AuthenticatedConversation
            key={conversationUserId}
            userId={conversationUserId}
            thread={activeThread}
            welcome={welcome}
            pending={activeSubmission}
            onThreadReset={() => {
              setThread(null);
              setPendingSubmission(null);
            }}
          />
        ) : isPending ? (
          <StaticConversation />
        ) : (
          <StaticConversation>{welcome}</StaticConversation>
        )}
      </div>
      <Composer
        userId={userId}
        thread={activeThread}
        onThreadReady={setThread}
        onSubmissionStart={setPendingSubmission}
        onSubmissionError={submissionId =>
          setPendingSubmission(current =>
            current?.id === submissionId ? null : current,
          )
        }
      />
    </>
  );
}
