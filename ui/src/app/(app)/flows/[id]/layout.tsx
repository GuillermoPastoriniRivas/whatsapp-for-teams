export function generateStaticParams() {
  return [{ id: "__dynamic__" }];
}

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
