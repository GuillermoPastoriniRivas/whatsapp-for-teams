import { Hexagon } from "lucide-react";

export default function ConversationsEmptyState() {
  return (
    <div className="hidden md:flex flex-col h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6 shadow-sm border border-primary/20">
        <Hexagon className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
        Hivvo.chat
      </h2>
      <p className="max-w-md text-slate-500 dark:text-slate-400">
        Select a conversation to start messaging. Manage all your channels from one place.
      </p>
    </div>
  );
}
