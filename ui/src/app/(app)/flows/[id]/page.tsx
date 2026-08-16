"use client";

import { useParams } from "next/navigation";
import { usePathname } from "next/navigation";
import { FlowBuilder } from "@/components/flows/flow-builder";
import { browserPathParam } from "@/lib/static-route-param";

export default function Page() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  return <FlowBuilder flowId={browserPathParam(pathname, params.id)} />;
}
