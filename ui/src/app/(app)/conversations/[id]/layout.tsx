export function generateStaticParams() {
  return [{ id: "__dynamic__" }];
}

export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
