"use client";

import { Component, useEffectEvent, useLayoutEffect, useState } from "react";
import Image from "next/image";
import { useSmoothText, useUIMessages } from "@convex-dev/agent/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowUpIcon,
  CheckIcon,
  LoaderCircleIcon,
  MenuIcon,
  MessageSquareIcon,
  PlusIcon,
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
import { ScrollArea } from "~~/components/ui/scroll-area";
import { Separator } from "~~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~~/components/ui/sheet";
import { Skeleton } from "~~/components/ui/skeleton";
import { authClient } from "~~/lib/auth-client";
import {
  mintUpApi,
  type MintiMessage,
  type MintiThread,
} from "~~/lib/mint-up-api";
import { EventRecommendationCard } from "./event-recommendation-card";
import {
  getActiveSubmission,
  getConversationUserId,
  getConversationRevision,
  getMessageScrollMetadata,
  hasAssistantMessageAfter,
  selectConversationMessages,
} from "./minti-chat-state";

const THREAD_STORAGE_PREFIX = "mint-up:minti-thread:";
const threadDateFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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

function formatThreadLabel(createdAt: number) {
  return threadDateFormatter.format(createdAt);
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

  if (!searchPart) return { label: "Pensando...", searching: false };

  switch (searchPart.state) {
    case "input-streaming":
      return {
        label: "Preparando una búsqueda de eventos...",
        searching: true,
      };
    case "input-available":
      return {
        label: "Buscando en el índice actual de eventos...",
        searching: true,
      };
    case "output-available":
      return { label: "Revisando los eventos encontrados...", searching: true };
    case "output-error":
      return { label: "Procesando el error de búsqueda...", searching: false };
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
        La búsqueda de eventos falló. Intenta reformular tu solicitud.
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
            ? "No se encontraron eventos"
            : `${events.length} ${events.length === 1 ? "evento encontrado" : "eventos encontrados"}`}
        </MarkerContent>
      </Marker>
      {unresolvedFilters.length > 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          No pude interpretar: {unresolvedFilters.join(", ")}.
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
                  Asistente de eventos
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
                Respuesta completada
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
              Asistente de eventos
            </span>
          </MessageHeader>
          <AssistantActivity label="Pensando..." />
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
                  Cargar mensajes anteriores
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

type SelectedThread = {
  userId: string;
  threadId: string;
};

type PendingSubmission = {
  id: string;
  userId: string;
  threadId: string | null;
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
          <DialogTitle>Inicia sesión para preguntarle a Minti</DialogTitle>
          <DialogDescription>
            Tu mensaje está listo. Inicia sesión para comenzar la conversación.
          </DialogDescription>
        </DialogHeader>
        <GoogleSignInButton callbackUrl="/chat" />
      </DialogContent>
    </Dialog>
  );
}

function Composer({
  userId,
  selectedThread,
  isSending,
  onSendingChange,
  onThreadSelected,
  onSubmissionStart,
  onSubmissionError,
}: {
  userId: string | undefined;
  selectedThread: SelectedThread | null;
  isSending: boolean;
  onSendingChange: (isSending: boolean) => void;
  onThreadSelected: (thread: SelectedThread, submissionId: string) => void;
  onSubmissionStart: (submission: PendingSubmission) => void;
  onSubmissionError: (submissionId: string) => void;
}) {
  const createThread = useMutation(mintUpApi.minti.createThread);
  const sendMessage = useAction(mintUpApi.minti.sendMessage);
  const [prompt, setPrompt] = useState("");
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
      threadId:
        selectedThread?.userId === userId ? selectedThread.threadId : null,
      prompt: nextPrompt,
      createdAt: Date.now(),
    };
    onSendingChange(true);
    setPrompt("");
    onSubmissionStart(submission);

    try {
      let threadId =
        selectedThread?.userId === userId ? selectedThread.threadId : null;

      if (!threadId) {
        threadId = await createThread({});
      }

      onThreadSelected({ userId, threadId }, submission.id);
      await sendMessage({ threadId, prompt: nextPrompt });
    } catch {
      onSubmissionError(submission.id);
      setError(
        "Minti no pudo completar esa respuesta. Revisa la conversación antes de volver a intentarlo.",
      );
    } finally {
      onSendingChange(false);
    }
  }

  return (
    <>
      <div className="relative z-10 border-t bg-background/85 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        <form
          className="mx-auto max-w-3xl"
          aria-label="Pregúntale a Minti"
          onSubmit={submit}
        >
          <InputGroup className="min-h-14 rounded-2xl border-border bg-background shadow-[0_1px_2px_oklch(0_0_0/0.05),0_8px_30px_oklch(0_0_0/0.06)] has-[textarea]:rounded-2xl">
            <InputGroupTextarea
              aria-label="Mensaje para Minti"
              placeholder="Pregunta por eventos, personas, lugares o tu presupuesto..."
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
                aria-label="Enviar mensaje"
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
              Minti puede cometer errores. Confirma los detalles en la página
              del evento.
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
            Esta conversación ya no está disponible.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={this.props.onReset}
          >
            Iniciar una conversación nueva
          </Button>
        </div>
      </div>
    );
  }
}

function AuthenticatedConversation({
  selectedThread,
  welcome,
  pending,
  onThreadReset,
}: {
  selectedThread: SelectedThread | null;
  welcome: React.ReactNode;
  pending: PendingSubmission | null;
  onThreadReset: () => void;
}) {
  const threadId = selectedThread?.threadId;

  if (!threadId) {
    return <StaticConversation pending={pending}>{welcome}</StaticConversation>;
  }

  return (
    <ThreadErrorBoundary
      key={threadId}
      onReset={() => {
        onThreadReset();
      }}
    >
      <Conversation threadId={threadId} welcome={welcome} pending={pending} />
    </ThreadErrorBoundary>
  );
}

function ConversationNavigation({
  threads,
  threadsLoading,
  signedIn,
  selectedThreadId,
  disabled,
  onNewChat,
  onSelectThread,
}: {
  threads: MintiThread[];
  threadsLoading: boolean;
  signedIn: boolean;
  selectedThreadId: string | undefined;
  disabled: boolean;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          disabled={disabled}
          onClick={onNewChat}
        >
          <PlusIcon />
          Nueva conversación
        </Button>
      </div>
      <Separator />
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-medium text-muted-foreground">Recientes</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Conversaciones" className="space-y-1 px-2 pb-3">
          {threadsLoading ? (
            <>
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-4/5 rounded-md" />
              <Skeleton className="h-9 w-11/12 rounded-md" />
            </>
          ) : !signedIn ? (
            <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
              Inicia sesión para ver tus conversaciones.
            </p>
          ) : threads.length === 0 ? (
            <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
              Tus conversaciones aparecerán aquí.
            </p>
          ) : (
            threads.map(thread => {
              const isActive = thread.threadId === selectedThreadId;
              const label = formatThreadLabel(thread.createdAt);

              return (
                <Button
                  key={thread.threadId}
                  type="button"
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 w-full justify-start gap-2 px-2 font-normal"
                  aria-current={isActive ? "page" : undefined}
                  disabled={disabled}
                  title={label}
                  onClick={() => onSelectThread(thread.threadId)}
                >
                  <MessageSquareIcon className="shrink-0" />
                  <span className="truncate">{label}</span>
                </Button>
              );
            })
          )}
        </nav>
      </ScrollArea>
    </div>
  );
}

export function MintiChat({
  welcome,
  header,
}: {
  welcome: React.ReactNode;
  header: React.ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const { isAuthenticated } = useConvexAuth();
  const threads = useQuery(
    mintUpApi.minti.listThreads,
    userId && isAuthenticated ? {} : "skip",
  );
  const [selectedThread, setSelectedThread] = useState<SelectedThread | null>(
    () => {
      const userId = session?.user.id;
      const threadId = userId
        ? readSavedThread(`${THREAD_STORAGE_PREFIX}${userId}`)
        : null;
      return userId && threadId ? { userId, threadId } : null;
    },
  );
  const [pendingSubmission, setPendingSubmission] =
    useState<PendingSubmission | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lastSettledUserId, setLastSettledUserId] = useState(userId);
  if (!isPending && lastSettledUserId !== userId) {
    setLastSettledUserId(userId);
    const savedThreadId = userId
      ? readSavedThread(`${THREAD_STORAGE_PREFIX}${userId}`)
      : null;
    setSelectedThread(
      userId && savedThreadId ? { userId, threadId: savedThreadId } : null,
    );
  }
  const conversationUserId = getConversationUserId(
    userId,
    isPending,
    lastSettledUserId,
  );
  const activeThread =
    selectedThread?.userId === conversationUserId ? selectedThread : null;
  const activeSubmission = getActiveSubmission(
    pendingSubmission,
    conversationUserId,
    activeThread?.threadId ?? null,
  );
  const threadList = threads ?? [];
  const threadsLoading =
    isPending || Boolean(userId && (!isAuthenticated || !threads));

  function startNewChat() {
    if (userId) removeSavedThread(`${THREAD_STORAGE_PREFIX}${userId}`);
    setSelectedThread(null);
    setPendingSubmission(null);
    setIsSidebarOpen(false);
  }

  function selectThread(threadId: string) {
    if (!userId) return;
    if (threadId === activeThread?.threadId) {
      setIsSidebarOpen(false);
      return;
    }
    saveThread(`${THREAD_STORAGE_PREFIX}${userId}`, threadId);
    setSelectedThread({ userId, threadId });
    setPendingSubmission(null);
    setIsSidebarOpen(false);
  }

  return (
    <div className="grid size-full min-h-0 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r bg-muted/25 lg:flex">
        <ConversationNavigation
          threads={threadList}
          threadsLoading={threadsLoading}
          signedIn={Boolean(userId)}
          selectedThreadId={activeThread?.threadId}
          disabled={isSending}
          onNewChat={startNewChat}
          onSelectThread={selectThread}
        />
      </aside>
      <section
        aria-label="Conversación para descubrir eventos"
        className="flex min-h-0 min-w-0 flex-col"
      >
        <div className="relative shrink-0">
          {header}
          <div className="absolute top-2 left-3 lg:hidden">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Abrir conversaciones"
                  />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(20rem,85vw)] p-0">
                <SheetHeader className="border-b px-4 py-3">
                  <SheetTitle>Conversaciones</SheetTitle>
                </SheetHeader>
                <ConversationNavigation
                  threads={threadList}
                  threadsLoading={threadsLoading}
                  signedIn={Boolean(userId)}
                  selectedThreadId={activeThread?.threadId}
                  disabled={isSending}
                  onNewChat={startNewChat}
                  onSelectThread={selectThread}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {conversationUserId ? (
            <AuthenticatedConversation
              key={conversationUserId}
              selectedThread={activeThread}
              welcome={welcome}
              pending={activeSubmission}
              onThreadReset={() => {
                removeSavedThread(
                  `${THREAD_STORAGE_PREFIX}${conversationUserId}`,
                );
                setSelectedThread(null);
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
          selectedThread={activeThread}
          isSending={isSending}
          onSendingChange={setIsSending}
          onThreadSelected={(nextThread, submissionId) => {
            saveThread(
              `${THREAD_STORAGE_PREFIX}${nextThread.userId}`,
              nextThread.threadId,
            );
            setSelectedThread(nextThread);
            setPendingSubmission(current =>
              current?.id === submissionId
                ? { ...current, threadId: nextThread.threadId }
                : current,
            );
          }}
          onSubmissionStart={setPendingSubmission}
          onSubmissionError={submissionId =>
            setPendingSubmission(current =>
              current?.id === submissionId ? null : current,
            )
          }
        />
      </section>
    </div>
  );
}
