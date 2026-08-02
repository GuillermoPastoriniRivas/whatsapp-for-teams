import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Asis Chat",
  description: "Atención por WhatsApp para equipos, con IA",
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    // iOS toma el nombre del ícono de acá, no del manifest.
    title: "Asis Chat",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // El teclado encoge el layout (header fijo arriba, composer sobre el teclado)
  // en vez de superponerse y empujar la página hacia arriba
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#04070f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
