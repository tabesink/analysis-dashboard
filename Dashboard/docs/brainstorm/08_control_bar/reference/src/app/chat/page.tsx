import { LightRagChatShell } from "@/components/chat/LightRagChatShell";
import { AppPageFrame } from "@/components/layout/AppPageFrame";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <AppPageFrame>
      <LightRagChatShell />
    </AppPageFrame>
  );
}
