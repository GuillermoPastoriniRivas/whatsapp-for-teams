"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { LoadingState } from "@/components/ui/spinner";
import { browserPathParam } from "@/lib/static-route-param";

export default function ChatPage() {
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(browserPathParam(pathname, ""));
  }, [pathname]);

  if (!id) {
    return <LoadingState className="h-full" />;
  }

  return (
    <div className="h-full">
      <ChatPanel conversationId={id} />
    </div>
  );
}
