# Sistema de diseño de asis.chat

Reglas del producto, no sugerencias. Si una pantalla necesita algo que no está
acá, se agrega el componente al sistema — no se resuelve con clases sueltas.

Base: Tailwind v4 (tokens en `src/app/globals.css`, no hay `tailwind.config`),
shadcn estilo radix-nova (`data-slot`, sin `forwardRef`), paquete unificado
`radix-ui`, `cva` para variantes.

## Principios

1. **Mobile-first.** El teléfono es el caso principal. Lo tocable llega a 40px
   como mínimo en mobile; recién desde `md:` se compacta.
2. **Solo tokens.** `primary`, `muted-foreground`, `border`, `destructive`…
   Nunca `slate-*`/`gray-*`/`zinc-*` ni hex sueltos. Las excepciones, todas
   deliberadas: `status-pill.tsx` (paleta semántica de estados), los tokens
   `--asis-*` del lenguaje WhatsApp (chat y previsualizaciones de plantillas),
   el verde `#25D366` de la marca WhatsApp, el `themeColor` del `<head>` (es un
   meta del navegador, no acepta variables) y los colores de marca del logo
   (`FLUWS_GREEN` / `FLUWS_INK`), que no siguen al tema.
3. **Un patrón por problema.** Si ya existe el componente, se usa; no se copia
   el markup a otra pantalla.

## Tipografía

Solo escala estándar de Tailwind. **Prohibido `text-[19px]` y similares.**

| Rol | Clases |
|---|---|
| Título de pantalla (`h1`) | `text-xl font-semibold tracking-tight` |
| Subtítulo de pantalla | `text-sm text-muted-foreground` |
| Título de sección / `CardTitle` | `text-base font-semibold` |
| Etiqueta de campo | `text-sm font-medium` |
| Cuerpo | `text-sm` |
| Metadatos, ayudas | `text-xs text-muted-foreground` (nunca más chico, nunca con `/70`) |
| Números destacados (KPIs) | `text-2xl font-semibold tabular-nums` |
| Display (marketing, auth) | `text-3xl lg:text-4xl font-bold tracking-tight` |

## Radios

| Elemento | Radio |
|---|---|
| Controles (input, button, select) | `rounded-lg` |
| Cards, paneles, diálogos | `rounded-xl` |
| Hojas inferiores | `rounded-t-2xl` (único uso de `2xl`) |
| Pills, badges, avatares, puntos | `rounded-full` |
| Chips diminutos, ítems de menú | `rounded-md` |

Los CTA `rounded-full` de las páginas de marketing son una excepción de marca.

## Alturas de controles

Van en el `cva` del primitivo, no en la página.

| Control | Mobile | Desktop (`md:`) |
|---|---|---|
| Input / Textarea / Select | `h-10` | `h-8` |
| Button `default` | `h-10` | `h-8` |
| Button `sm` | `h-9` | `h-7` |
| Button `lg` (auth, CTAs) | `h-11` | `h-9` |
| `icon` / `icon-sm` | `size-10` / `size-9` | `size-8` / `size-7` |
| Filas tocables (nav, listas) | `min-h-11` | — |

`xs` e `icon-xs` quedan reservados a superficies densas de escritorio.

## Espaciado

- Cabecera de pantalla: `px-4 py-3 md:px-6`
- Contenido: `p-4 pb-20 md:p-6 md:pb-6` (el `pb-20` deja pasar la bottom-nav)
- Pilas de secciones: `space-y-4 md:space-y-6`
- Formularios: `space-y-4` entre campos, `space-y-1.5` dentro del campo

## Color y superficie

- Card: la que da el primitivo (`rounded-xl ring-1 ring-foreground/10`). No se
  le agregan sombras propias.
- Card interactiva: `transition-colors hover:bg-muted/50`.
- Card seleccionada: `border-primary/40 bg-primary/5`.
- `shadow-lg` solo en capas flotantes (diálogos, popovers, toasts).

## Apilado

Para chrome y capas flotantes, siempre `z-(--z-*)`, nunca un número suelto:

`--z-sticky: 10` · `--z-panel: 40` · `--z-nav: 50` · `--z-overlay: 60` ·
`--z-popover: 65` · `--z-toast: 70`

`--z-popover` va por encima de `--z-overlay` a propósito: un dropdown tiene que
poder abrirse **dentro** de un diálogo. Un `z-10` local para ordenar dos
elementos dentro de un mismo componente no participa de esta escala y está bien.

## Componentes: qué usar para qué

| Necesidad | Componente |
|---|---|
| Estructura de pantalla | `PageShell` + `PageHeader` + `PageContent` |
| Campo de formulario | `Field` (ata etiqueta y control, publica el error) |
| Error o aviso en línea | `InlineNotice` (`success` / `error` / `warning` / `info`) |
| Aviso efímero | `toast.success/error/info` de `lib/toast` |
| Confirmar una acción | `useConfirm()` — nunca `window.confirm` |
| Diálogo | `ResponsiveDialog` (hoja inferior en mobile, modal en desktop) |
| Panel maestro-detalle | `RightPanel` |
| Estado de un registro | `StatusPill` / `StatusDot` |
| Filtro de listado | `FilterPill` |
| Lista vacía | `EmptyState` |
| Cargando | `Spinner` / `LoadingState` |
| Paginar | `Pagination` |
| Navegación | `lib/nav-config.ts` (sidebar y mobile leen de ahí) |

## Listas

Tabla en escritorio (`hidden md:block`) y cards apiladas en mobile
(`md:hidden`). Las cards no son un espejo de las columnas: muestran lo que
importa en pantalla chica. Nunca dejar una tabla con scroll horizontal como
única salida en mobile.

## Trampas conocidas

- **`.content-zoom`**: el `<main>` lleva `zoom` configurable por el usuario, y
  `zoom` crea un containing block para `position: fixed`. Todo lo flotante tiene
  que portalear a `body` — Radix ya lo hace; si se escribe algo a mano, va con
  `createPortal`.
- **Breakpoints**: las media queries miden el viewport, no el ancho real después
  del zoom. Por eso `globals.css` neutraliza el zoom entre 768 y 1180px.
- **i18n**: toda clave nueva va en `es` **y** en `en`. El tipo aplana a `string`,
  así que una clave faltante no la marca TypeScript.
- **Build**: `npm run build` con `next dev` levantado devuelve 404 en las rutas
  dinámicas. Bajar el dev server antes de compilar.
