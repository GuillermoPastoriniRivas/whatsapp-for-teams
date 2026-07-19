"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, User } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";

interface Props {
  onViewContact: () => void;
}

export function ChatMenu({ onViewContact }: Props) {
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
