"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/conversations");
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground w-full h-full bg-slate-50 dark:bg-slate-900">
      Loading workspace...
    </div>
  );
}
