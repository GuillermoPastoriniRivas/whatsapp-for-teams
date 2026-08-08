import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";

/**
 * Pinta el tema antes del primer render. Sin esto, quien elige oscuro ve un
 * destello blanco en cada carga mientras hidrata el store.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("asis-theme")||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Tipografía de marca: SOLO para el wordmark, no para la interfaz. La UI sigue
 * en Inter, que es la que está pensada para leerse en tablas y formularios.
 *
 * Outfit es geométrica y de bocetos circulares, que es lo que rima con el
 * anillo del símbolo. Para cambiarla, se toca acá y en `--font-brand` de
 * globals.css; el componente del wordmark no se entera.
 */
const brandFont = Outfit({
  variable: "--font-brand-family",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "fluws",
  description:
    "Automatizá el WhatsApp de tu empresa: una IA que responde en segundos las 24 horas, bandeja compartida para tu equipo y campañas masivas.",
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    // iOS toma el nombre del ícono de acá, no del manifest.
    title: "fluws",
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
      className={`${inter.variable} ${brandFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeProvider />
        {children}
        <Toaster />
        <ConfirmDialogHost />
      </body>
    </html>
  );
}
