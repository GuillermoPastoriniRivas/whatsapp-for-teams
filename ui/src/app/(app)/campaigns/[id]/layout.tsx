export function generateStaticParams() {
  return [{ id: "__dynamic__" }];
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
