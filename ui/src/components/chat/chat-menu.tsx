"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, User, UserPlus, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

interface Props {
  onViewContact: () => void;
  onAssign: () => void;
  onResolve: () => void;
  isResolved: boolean;
}

export function ChatMenu({ onViewContact, onAssign, onResolve, isResolved }: Props) {
  const agent = useAuthStore((s) => s.agent);
  const isAdmin = agent?.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-full h-10 w-10"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onViewContact} className="gap-2">
          <User className="h-4 w-4" />
          Contact info
        </DropdownMenuItem>
        {isAdmin && !isResolved && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAssign} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Assign to agent
            </DropdownMenuItem>
          </>
        )}
        {!isResolved && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onResolve} className="gap-2 text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              Mark as resolved
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
