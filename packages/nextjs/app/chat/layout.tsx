import { ChatConvexProvider } from "./_components/chat-convex-provider";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatConvexProvider>{children}</ChatConvexProvider>;
}
