"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, User, UserPlus, Hand } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";

interface Props {
  onViewContact: () => void;
  onAssign: () => void;
  onClaim: () => void;
  isMine: boolean;
}

export function ChatMenu({ onViewContact, onAssign, onClaim, isMine }: Props) {
  const agent = useAuthStore((s) => s.agent);
  const isAdmin = agent?.role === "admin";
  const { t } = useTranslations();

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
          {t.chat.contactInfo}
        </DropdownMenuItem>
        {!isMine && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClaim} className="gap-2">
              <Hand className="h-4 w-4" />
              {t.chat.claim}
            </DropdownMenuItem>
          </>
        )}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAssign} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {t.chat.assignToAgent}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
