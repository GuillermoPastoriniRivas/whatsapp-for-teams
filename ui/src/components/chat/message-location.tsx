"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";

import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import type { MessageLocation } from "@/types";

/**
 * Ubicación compartida por un contacto: mapa estático + dirección + acceso a
 * una app de mapas real.
 *
 * El mapa se arma con tiles de OpenStreetMap servidos directamente, sin SDK ni
 * API key: un `<img>` por tile posicionado en un mosaico. Alcanza para un
 * preview y evita meter una librería de mapas entera en el bundle del chat.
 * El origen se puede cambiar con `NEXT_PUBLIC_MAP_TILE_URL` (plantilla
 * `{z}/{x}/{y}`) para apuntar a un tile server propio o pago.
 */

const TILE_SIZE = 256;
const ZOOM = 15;
const WIDTH = 260;
const HEIGHT = 150;

const TILE_TEMPLATE =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Lat/lon → píxel absoluto en el mundo Web Mercator, al zoom dado. */
function project(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;
  const x = ((longitude + 180) / 360) * scale;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x: x * TILE_SIZE, y: y * TILE_SIZE, tiles: scale };
}

interface Tile {
  key: string;
  url: string;
  left: number;
  top: number;
}

/** Tiles que cubren el recuadro centrado en el punto, ya posicionados. */
function buildTiles(latitude: number, longitude: number): Tile[] {
  const { x, y, tiles } = project(latitude, longitude, ZOOM);
  const left = x - WIDTH / 2;
  const top = y - HEIGHT / 2;

  const firstX = Math.floor(left / TILE_SIZE);
  const firstY = Math.floor(top / TILE_SIZE);
  const lastX = Math.floor((left + WIDTH) / TILE_SIZE);
  const lastY = Math.floor((top + HEIGHT) / TILE_SIZE);

  const out: Tile[] = [];
  for (let tx = firstX; tx <= lastX; tx++) {
    for (let ty = firstY; ty <= lastY; ty++) {
      // Fuera del mundo en vertical no hay tile; en horizontal el mundo da la vuelta.
      if (ty < 0 || ty >= tiles) continue;
      const wrappedX = ((tx % tiles) + tiles) % tiles;
      out.push({
        key: `${tx}:${ty}`,
        url: TILE_TEMPLATE.replace("{z}", String(ZOOM))
          .replace("{x}", String(wrappedX))
          .replace("{y}", String(ty)),
        left: tx * TILE_SIZE - left,
        top: ty * TILE_SIZE - top,
      });
    }
  }
  return out;
}

interface Props {
  location: MessageLocation;
  outbound?: boolean;
}

export function MessageLocation({ location, outbound }: Props) {
  const { t } = useTranslations();
  const [tilesFailed, setTilesFailed] = useState(false);

  const tiles = useMemo(
    () => buildTiles(location.latitude, location.longitude),
    [location.latitude, location.longitude]
  );

  const coords = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  const title = location.name || location.address || t.chat.sharedLocation;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t.chat.openInMaps}: ${title}`}
      /* El ancho lo fija el mapa: si la tarjeta estira, el pie queda más ancho
         que los tiles y se ve un escalón contra el borde de la burbuja. */
      style={{ width: WIDTH }}
      className={cn(
        "-mx-1 mb-1 block max-w-full overflow-hidden rounded-xl border transition-opacity hover:opacity-95",
        outbound ? "border-black/10" : "border-black/5"
      )}
    >
      {/* `overflow-hidden` no es cosmético: cada tile mide 256px y el mosaico
          desborda el alto del mapa, tapando el pie con el nombre del lugar. */}
      <div className="relative overflow-hidden bg-muted" style={{ height: HEIGHT }}>
        {!tilesFailed && (
          // Los tiles son claros; en dark mode se invierten para no encandilar.
          <div className="absolute inset-0 dark:brightness-90 dark:contrast-90 dark:invert dark:hue-rotate-180">
            {tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                width={TILE_SIZE}
                height={TILE_SIZE}
                loading="lazy"
                onError={() => setTilesFailed(true)}
                className="absolute max-w-none"
                style={{ left: tile.left, top: tile.top }}
              />
            ))}
          </div>
        )}

        {/* El pin va en el centro geométrico: el mosaico se centró en el punto. */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow">
          <MapPin className="size-7 fill-destructive text-destructive-foreground" />
        </span>

        {!tilesFailed && (
          <span className="absolute bottom-0 right-0 bg-background/70 px-1 text-[10px] leading-tight text-muted-foreground">
            © OpenStreetMap
          </span>
        )}
      </div>

      <div className="bg-background/60 px-2.5 py-1.5">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {location.address && location.name ? location.address : coords}
        </p>
      </div>
    </a>
  );
}
