import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Nombre de la app instalada. `short_name` es el que va debajo del ícono
    // en el escritorio y en la pantalla de inicio, y ahí el espacio es poco:
    // "asis.chat" entra justo, cualquier cosa más larga se corta con puntos
    // suspensivos.
    name: "asis.chat",
    short_name: "asis.chat",
    description: "Atención por WhatsApp para equipos, con IA",
    id: "/",
    start_url: "/conversations",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    background_color: "#ffffff",
    // El verde de la interfaz. Va en hex porque el manifest lo lee el
    // sistema operativo, no el navegador: no puede resolver var(--primary).
    theme_color: "#027E5A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
