import Script from "next/script";

const ANALYTICS_SCRIPT_URL = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
const ANALYTICS_SITE_ID = process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID;

export function CookielessAnalytics() {
  if (!ANALYTICS_SCRIPT_URL || !ANALYTICS_SITE_ID) return null;

  return (
    <Script
      src={ANALYTICS_SCRIPT_URL}
      data-domain={ANALYTICS_SITE_ID}
      data-website-id={ANALYTICS_SITE_ID}
      strategy="afterInteractive"
      defer
    />
  );
}
