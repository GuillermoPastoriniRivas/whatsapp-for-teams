"use client";

import { use, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { browserPathParam } from "@/lib/static-route-param";

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: generatedId } = use(params);
  const pathname = usePathname();
  const [id, setId] = useState(generatedId);

  useEffect(() => {
    setId(browserPathParam(pathname, generatedId));
  }, [generatedId, pathname]);

  return (
    <div className="h-full">
      <ChatPanel conversationId={id} />
    </div>
  );
}
