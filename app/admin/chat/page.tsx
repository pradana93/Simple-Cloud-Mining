import { listChatThreads } from "@/lib/chat";
import { ChatConsole } from "@/components/admin/chat-console";

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  const threads = await listChatThreads();
  return <ChatConsole initialThreads={threads} />;
}
