import { MessageSquare } from "lucide-react";

export default function ConversationsEmptyState() {
  return (
    <div className="hidden md:flex flex-col h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <MessageSquare className="h-10 w-10 text-slate-400 dark:text-slate-500" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
        WhatsApp for Teams
      </h2>
      <p className="max-w-md text-slate-500 dark:text-slate-400">
        Send and receive messages without staying online. Select a conversation to start messaging. Let's make communication faster and easier for the entire enterprise.
      </p>
      <div className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-600">
        <span className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-100 dark:ring-green-900/30"></span> 
        End-to-end encryption supported
      </div>
    </div>
  );
}
