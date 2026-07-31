"use client";

import { useParams } from "next/navigation";
import { FlowBuilder } from "@/components/flows/flow-builder";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <FlowBuilder flowId={params.id} />;
}
