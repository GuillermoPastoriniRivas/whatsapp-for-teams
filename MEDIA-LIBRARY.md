# Media Library + Storage as a Service — asis.chat

Diseño y estado de implementación. Las decisiones están cerradas (§14) y las fases
1 a 3 están construidas — ver §15 para el mapa de archivos y lo que queda pendiente.

---

## 1. Por qué esto es un producto y no una feature

Meta retiene el media **30 días**. Pasado ese plazo el `media_id` devuelve 404 y el
archivo desaparece para siempre. Cualquier negocio que use WhatsApp en serio
(comprobantes de pago, fotos de reclamos, DNIs, remitos, historias clínicas) está
perdiendo información sin saberlo.

La propuesta: **asis.chat guarda todo lo que pasa por tus números, para siempre**,
con un lugar donde buscarlo, reusarlo y reenviarlo. Ese es el pitch, y es una línea
de facturación propia (GB almacenados + retención por plan).

**El plan Free no guarda nada** — funciona 100 % contra Meta, con las reglas de
Meta, incluidos los 30 días. Eso no es una limitación que inventamos: es lo que el
cliente ya está sufriendo hoy sin enterarse. Nuestro trabajo es hacérselo visible
en el momento exacto en que le duele, y tener la solución del otro lado del botón.
El detalle completo del modelo de dos niveles está en §4.

---

## 2. De dónde partimos (auditoría previa)

Esto era el estado del código antes de empezar. Queda como registro de qué había
roto y por qué el proyecto valía la pena.

| Pieza | Estado previo |
|---|---|
| Parseo de media entrante | Guardaba una URL inservible (`graph.facebook.com/{v}/{mediaId}`), que no es descargable |
| Render de media en el chat | **No existía** — una foto entrante se veía como burbuja vacía |
| Envío de media desde la bandeja | **No existía** — `mediaUrl: null` hardcodeado |
| Botón de adjuntar | Decorativo, sin handler |
| Envío por `link:` en Meta | Implementado |
| Envío por `media_id` | **No existía** |
| Upload a Meta (`POST /{phoneId}/media`) | **No existía** |
| Resumable Upload API (`header_handle`) | **No existía** → templates con header multimedia rotos |
| `action.send_media` en flujos | Pedía la URL a mano en un input de texto |
| Storage | **No existía** |
| Cuota de storage en planes | **No existía** |
| `MessageType.STICKER` | **Faltaba** → los stickers entrantes se descartaban |

Lo bueno: la arquitectura ya tenía el andamiaje — ports (`MessagingApiPort`,
`JobQueuePort`, `RealtimeGatewayPort`), cola con Agenda, estrategia por proveedor,
eventos de developer, WebSocket. El módulo de media encajó sin pelear con nada.

---

## 3. Las reglas del juego de WhatsApp Cloud API

Esto no es negociable, condiciona todo el diseño.

### 3.1 Recibir

El webhook trae **un ID, no el archivo**:

```json
{ "type": "image",
  "image": { "id": "1234567890", "mime_type": "image/jpeg", "sha256": "...", "caption": "opcional" } }
```

Para bajarlo hacen falta **dos requests**:

1. `GET https://graph.facebook.com/v21.0/{MEDIA_ID}` con `Authorization: Bearer {token}`
   → `{ url, mime_type, sha256, file_size }`
2. `GET {url}` con **el mismo Bearer token Y un header `User-Agent`**
   → los bytes

Gotchas que cuestan horas:

- La `url` del paso 1 vive **~5 minutos**. Si el job reintenta después, hay que
  rehacer el paso 1, no reusar la URL.
- **Sin `User-Agent` Meta devuelve 400.** No está documentado de forma prominente.
- El token tiene que ser el que tiene acceso a esa WABA. En multi-tenant es
  `phone.providerConfig.accessToken` — ya lo tenemos por número.
- El `sha256` viene en base64: sirve para verificar integridad **y como clave de
  deduplicación gratis**.
- Documentos traen `filename` del cliente. Audios traen `voice: true` si es una nota
  de voz (se renderiza distinto). Stickers traen `animated: bool`.

Límites de entrada: imagen 5 MB · audio 16 MB · video 16 MB · documento 100 MB ·
sticker 100 KB estático / 500 KB animado.

### 3.2 Enviar — dos caminos

**(a) Por `link`** — le pasás una URL pública y Meta la descarga:

```json
{ "type": "image", "image": { "link": "https://...", "caption": "..." } }
```

Requiere URL **pública sin auth**, TLS válido, y **`Content-Type` correcto en la
respuesta**. Si el header no coincide con el tipo declarado, Meta rechaza con un
error críptico. Es el camino que ya está implementado.

**(b) Por `media_id`** — subís los bytes primero:

```
POST /{PHONE_NUMBER_ID}/media   (multipart: messaging_product=whatsapp, file, type)
  → { "id": "9876543210" }
```

```json
{ "type": "image", "image": { "id": "9876543210" } }
```

Diferencias que importan:

| | `link` | `media_id` |
|---|---|---|
| Expone la URL públicamente | **Sí** | No |
| Meta tiene que poder alcanzar tu server | Sí (timeouts, DNS, TLS) | No |
| Reuso en campañas masivas | Meta refetchea (caché no confiable) | **1 upload → 10.000 envíos** |
| Scope | Global | **Atado al `phoneNumberId`** |
| Retención en Meta | — | 30 días |

El detalle crítico: **el `media_id` es por número de teléfono**. Un tenant con 3
números necesita 3 uploads del mismo archivo.

### 3.3 Templates con header multimedia — una tercera API

Crear un template con header `IMAGE`/`VIDEO`/`DOCUMENT` exige un **`header_handle`**
de ejemplo, que se obtiene de la **Resumable Upload API**, que es *otra* API distinta:

```
POST /v21.0/{APP_ID}/uploads?file_length=...&file_type=...   → sesión
POST /v21.0/upload:{SESSION_ID}  (Authorization: OAuth {token}, bytes en el body)
  → { "h": "4::aW1hZ2UvanBlZw==:ARZ..." }
```

Es **app-scoped** (necesita el App ID, no el phone number ID). Después, al *enviar*
el template, el parámetro del header va con `link` o `id` normales.

Hoy [messaging-api.port.ts:14-16](api/src/application/ports/messaging-api.port.ts#L14-L16)
solo tipa `image?: { link: string }` — falta la variante `{ id }`.

### 3.4 Formatos: lo que WhatsApp acepta

- **Imagen**: `image/jpeg`, `image/png`. **Nada más.** Ni webp (eso es sticker), ni gif, ni heic.
- **Video**: `video/mp4`, `video/3gp` — H.264 + AAC, **una sola pista de audio**.
- **Audio**: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`, `audio/ogg` (**opus únicamente**).
- **Documento**: pdf, doc(x), ppt(x), xls(x), txt.
- **Sticker**: `image/webp`.

Consecuencia directa: **una foto de iPhone (HEIC, 4 MB) no se puede enviar tal cual**,
y **un GIF tampoco**. Si no transcodificamos, el agente aprieta enviar y falla sin
entender por qué. Esto es un generador de tickets de soporte garantizado.

---

## 4. Dos niveles: passthrough (Free) y almacenado (pago)

**Free no toca nuestro storage.** Es un *passthrough* puro contra Meta:

| | Free — passthrough | Pago — almacenado |
|---|---|---|
| **Enviar** | los bytes atraviesan la API → `POST /{phoneId}/media` → `media_id` → se envía. No se persisten. | bytes en S3 → upload a Meta → `media_id` cacheado por número |
| **Ver** | proxy en vivo: la API resuelve el `mediaId` contra Graph y streamea al navegador | presigned GET de S3, 15 min |
| **A los 30 días** | **el archivo desaparece** — la burbuja pasa a estado "expirado" con upsell | intacto según la retención del plan |
| **Media Library** | no existe | completa |
| **Costo para nosotros** | egress + CPU del proxy | storage + egress |

Esto tiene tres virtudes:

1. **El media funciona para todos desde el día uno** — hoy está roto para todos.
2. **El límite de 30 días de Meta se vuelve el argumento de venta**, y aparece
   exactamente donde duele: dentro de la conversación, cuando el agente busca un
   comprobante y ya no está.
3. **El passthrough se construye sin S3, sin Terraform, sin bucket.** Es la fase 1
   entera y se puede shipear en una semana.

### 4.1 Regla de oro de implementación

**El resto de la app no puede saber en qué plan está el tenant.** Un único port con
dos estrategias:

```ts
interface MediaAccessPort {
  // "dame una URL que el navegador pueda renderizar"
  resolveViewUrl(assetId): Promise<{ url, expiresAt } | { expired: true }>
  // "dame algo que Meta acepte para enviar por este número"
  resolveSendRef(assetId, phoneNumberId): Promise<{ mediaId } | { link }>
}
```

- `MetaPassthroughStrategy` (Free) — view = proxy; send = upload al vuelo.
- `StoredMediaStrategy` (pago) — view = presigned S3; send = `media_id` cacheado.

La burbuja del chat, los flujos, las campañas y la API pública llaman siempre lo
mismo. Si esto se filtra en `if (plan === 'free')` desperdigados, el código se
bifurca en dos productos y se vuelve inmantenible.

### 4.2 La metadata se guarda SIEMPRE, en todos los planes

Aunque en Free no guardemos un solo byte, **sí creamos el registro `MediaAsset`**
con `mimeType`, `filename`, `sizeBytes`, `sha256`, `metaMediaId`, `metaExpiresAt`
y `status: 'meta_only'`. Es barato (unos cientos de bytes) y habilita cuatro cosas
que sin eso son imposibles:

- Mostrar una tarjeta de archivo decente (nombre, peso, ícono) **incluso después de
  que expiró** — en vez de una burbuja rota.
- Un estado `expired_at_source` honesto y preciso en lugar de un spinner infinito.
- **El backfill al upgradear** (§4.3) sabe exactamente qué ir a buscar.
- El contador de la conversión: *"este mes recibiste 412 archivos, 89 ya se
  perdieron"*. Un número real pega infinitamente más fuerte que "guardá tus archivos".

### 4.3 El upgrade: rescate de los últimos 30 días

Cuando un tenant Free pasa a Pro, **todo el media de los últimos 30 días todavía
existe en Meta**. Se dispara un job de backfill que recorre los `MediaAsset` con
`status: 'meta_only'` y `metaExpiresAt > now` y los ingesta.

```
"Recuperando tus archivos…  847 de 1.203"
"Listo. Rescatamos 1.203 archivos (4,2 GB) de los últimos 30 días."
```

Es el mejor momento de onboarding posible: valor tangible e inmediato en el
instante exacto en que pagaron. Y es **irrepetible** — lo de hace 31 días ya no
vuelve, lo cual también le da urgencia al upgrade.

Cuidados: throttlear contra los rate limits de Graph, reportar progreso por
WebSocket, y ser idempotente (que un reintento no duplique ni recobre).

### 4.4 El downgrade

Pago → Free necesita una política explícita y comunicada por mail **antes** de
borrar nada:

1. Se corta la ingesta nueva de inmediato (vuelve a passthrough).
2. Lo ya almacenado queda **accesible en modo lectura 60 días**, con banner.
3. Aviso a los 30, 7 y 1 día antes del borrado.
4. Exportación masiva (ZIP) disponible durante toda la ventana.
5. Recién ahí, borrado físico.

Borrar datos de un cliente sin aviso previo es, además de una mala jugada, un
problema legal.

---

## 5. La decisión central para planes pagos: cómo hacemos el media "enviable"

Esta es la pregunta que disparó todo el documento. Tres opciones:

**A. Bucket público / CDN abierto.** Simple, funciona con `link:`. Pero deja
permanentemente expuestos documentos de clientes de terceros. Para un SaaS
multi-tenant que va a guardar DNIs y comprobantes, es inaceptable como default.

**B. Proxy por la API con JWT.** Seguro, pero no sirve para `<img src>` sin token en
query, quema ancho de banda del EC2, y Meta no puede autenticarse para hacer el fetch.

**C. Bucket privado + dos caminos de acceso distintos.** ← **recomendado**

```
                    ┌─────────────────────────────────────────┐
                    │      S3 privado (sin acceso público)     │
                    │   tenants/{tenantId}/{yyyy}/{mm}/{sha}   │
                    └──────────────┬──────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                          │
    ┌─────────▼──────────┐                   ┌───────────▼────────────┐
    │  VER (inbox / lib) │                   │  ENVIAR (a WhatsApp)   │
    │                    │                   │                        │
    │  presigned GET     │                   │  stream S3 → POST      │
    │  TTL 15 min        │                   │  /{phoneId}/media      │
    │  emitido tras      │                   │  → media_id cacheado   │
    │  autorizar tenant  │                   │  TTL 25 días           │
    └────────────────────┘                   └────────────────────────┘
                                    (nunca se expone una URL pública)
```

**Regla:** para enviar a WhatsApp **siempre `media_id`, nunca `link`**. Con eso:

- Cero exposición pública. El bucket puede quedar 100% cerrado.
- Desaparece toda una clase de fallas ("Meta no pudo descargar tu URL": timeout,
  TLS, redirect, Content-Type).
- En campañas masivas: **1 upload por número, no 10.000 fetches de Meta.**
- El `link:` de [meta-cloud-api.service.ts:58](api/src/infrastructure/messaging/meta-cloud-api.service.ts#L58)
  queda como fallback legacy (útil para URLs externas que el tenant ya tiene).

**Escape hatch:** un flag por asset `publicLink: enabled | disabled` que genera una
URL firmada de larga duración y **revocable**, para los casos donde de verdad hace
falta una URL (integraciones externas, un flujo que manda el link a otro sistema).
Opt-in explícito, nunca por defecto.

### Backend de storage

**S3** — ya estamos en AWS (EC2, SES, SSM, Route53, Terraform) y `@aws-sdk/client-ses`
ya es dependencia. Se agregan `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

Detrás de un port `StoragePort` con tres adapters:

- `S3StorageAdapter` — producción
- `LocalDiskStorageAdapter` — desarrollo (que nadie necesite credenciales de AWS para levantar la app)
- el mismo local para el tenant demo ([demo-simulation.service.ts](api/src/infrastructure/demo/demo-simulation.service.ts))

El port deja la puerta abierta a **Cloudflare R2** (API compatible con S3, **egress
gratis**) si el costo de salida se vuelve dominante — ver §10.5.

---

## 6. Modelo de datos

### `MediaAsset` (colección nueva)

```ts
{
  id, tenantId,

  // contenido
  sha256,                 // clave de dedup — viene gratis del webhook de Meta
  sizeBytes,
  mimeType,               // detectado por magic bytes, NO el declarado
  kind: 'image'|'video'|'audio'|'document'|'sticker',
  filename,               // nombre original (documentos del cliente / upload del agente)

  // storage — NULL en plan Free (passthrough, no guardamos bytes)
  storageKey,             // tenants/{tenantId}/{yyyy}/{mm}/{sha256}
  storageProvider: 's3'|'local'|null,
  derivatives: [          // thumbs, posters, versiones transcodificadas
    { kind: 'thumb-200'|'thumb-800'|'poster'|'wa-compatible', storageKey, mimeType, sizeBytes }
  ],

  // origen en Meta — se guarda SIEMPRE, en todos los planes (§4.2)
  metaMediaId,            // el id del webhook, o el devuelto al subir
  metaExpiresAt,          // recibidoEn + 30d — la cuenta regresiva
  backfilledAt,           // rescatado al upgradear (§4.3)

  // origen
  source: 'inbound'|'agent_upload'|'api'|'flow'|'campaign'|'template',
  direction: 'in'|'out'|null,
  contactId, conversationId, messageId, phoneNumberId, campaignId,   // nullable
  uploadedByAgentId,

  // ciclo de vida
  status: 'meta_only'      // Free: solo vive en Meta, muere a los 30 días
        | 'pending'        // pago: en cola de ingesta
        | 'ready'          // pago: bytes nuestros
        | 'failed'
        | 'expired_at_source'   // se venció en Meta antes de que lo bajáramos
        | 'quarantined',   // antivirus
  failureReason,
  expiresAt,              // según retención del plan; null = para siempre
  refCount,               // cuántos mensajes/flujos/templates lo referencian
  deletedAt,              // soft delete

  // biblioteca (curaduría)
  inLibrary: boolean,     // ver §9.1 — separa "historial" de "biblioteca"
  tags: string[],
  folderId,
  title, description,

  // metadata de render (aspect ratio, duración en el player)
  width, height, durationMs,

  createdAt, updatedAt
}
```

Índices: `(tenantId, sha256)` único parcial · `(tenantId, createdAt)` ·
`(tenantId, kind, createdAt)` · `(tenantId, inLibrary, createdAt)` ·
`(conversationId)` · `(contactId)` · texto sobre `filename|title|description|tags`.

### `MediaProviderRef` (caché de `media_id`)

```ts
{ assetId, phoneNumberId, provider, providerMediaId, expiresAt }   // TTL 25 días
```

Único por `(assetId, phoneNumberId)`. TTL 25 días deja 5 de margen sobre los 30 de Meta.
También guarda el `header_handle` de la Resumable Upload API cuando aplica.

### Cambios en entidades existentes

- `Message`: agregar `mediaAssetId`, `mediaStatus: 'pending'|'ready'|'failed'`.
  Mantener `mediaUrl` para no romper nada, pero deja de ser la fuente de verdad.
- `MessageType`: agregar `STICKER`.
- `Tenant`: `storageUsedBytes`, `storageQuotaBytes`, `storageRetentionDays`.
- `PlanLimits`: `storageGb`, `mediaRetentionDays`, `mediaOverageAllowed`.

---

## 7. Flujo 1 — Recepción

### 7.1 Free — passthrough (sin ingesta)

El webhook crea el `MediaAsset` con `status: 'meta_only'` y **no baja nada**.
Cuando el agente abre la conversación:

```
<img src="/api/media/{assetId}/raw">
    │
    └─▶ GET /media/:assetId/raw   (JWT, valida que el asset sea del tenant)
            ├─ ¿metaExpiresAt < now?  → 410 Gone  → la UI muestra "archivo expirado" + upsell
            ├─ GET /{metaMediaId}          → url firmada (5 min)
            ├─ GET url (Bearer + User-Agent) → bytes
            └─ stream al navegador con:
                 Cache-Control: private, max-age=86400
                 ETag: {sha256}
                 Content-Disposition: inline|attachment
                 X-Content-Type-Options: nosniff
```

**Los tres riesgos del proxy, y cómo se tapan:**

1. **Rate limit de Graph.** Un agente scrolleando su bandeja puede disparar cientos
   de descargas. Meta throttlea los endpoints de media **a nivel WABA**, o sea que
   podría degradar el envío de mensajes del mismo número. Mitigación en capas:
   `Cache-Control` + `ETag` para que el navegador no repregunte (corta el 95 % del
   tráfico), rate limit propio por tenant, y una caché en disco de corta vida
   (1–24 h) en el EC2 para el hot set.
2. **Egress y CPU nuestros.** Cada byte pasa dos veces por el EC2 (baja de Meta,
   sube al navegador). Con thumbnails no se puede optimizar en Free porque no
   guardamos derivados — así que el listado de conversaciones debe usar
   `loading="lazy"` agresivo y no precargar.
3. **XSS.** El proxy sirve contenido de terceros. `nosniff`, nunca devolver
   `text/html` ni `image/svg+xml` (forzar `application/octet-stream`), y de ser
   posible montarlo en `media.asis.chat` y no en el dominio de la app (§11).

### 7.2 Pago — ingesta a nuestro storage

```
Webhook Meta
    │
    ├─▶ parser: extrae mediaId + mimeType + sha256 + filename + caption
    │
    ├─▶ INBOUND_MESSAGE_JOB  (ya existe)
    │       └─ crea el Message con mediaStatus: 'pending'
    │          → emite message.new  → la UI muestra un placeholder con spinner
    │
    └─▶ MEDIA_INGEST_JOB     (nuevo, en la cola de Agenda que ya existe)
            │
            ├─ 1. ¿ya existe un asset con ese (tenantId, sha256)?  → dedup, listo
            ├─ 2. GET /{mediaId}  → url firmada (5 min)
            ├─ 3. GET url (con User-Agent!) → bytes en streaming
            ├─ 4. verificar sha256 + detectar mime real por magic bytes
            ├─ 5. verificar cuota del tenant  (soft-fail, ver §10.3)
            ├─ 6. PUT a S3 (ContentType correcto, SSE, metadata de tenant)
            ├─ 7. generar derivados (thumb, poster) → job aparte
            ├─ 8. crear MediaAsset(status: 'ready') + linkear al Message
            └─ 9. emitir WS 'media.ready' → la UI reemplaza el placeholder
```

**Puntos que no se pueden saltear:**

- **Nunca descargar dentro del handler del webhook.** Meta espera el 200 rápido;
  descargar 100 MB inline arriesga que reintente y duplique.
- **Reintentos con backoff** (1 min, 5, 15, 1 h, 6 h). En cada reintento hay que
  rehacer el paso 2 — la URL caducó.
- **La cuenta regresiva de 30 días arranca al recibir.** Si un asset muere en la
  dead-letter queue, a los 30 días el archivo original ya no existe en ningún lado.
  → alerta operativa si `MEDIA_INGEST_JOB` acumula fallas, y estado
  `expired_at_source` para ser honestos en la UI en vez de mostrar un spinner eterno.
- **Idempotencia**: Meta reintenta webhooks. Clave `(waMessageId, mediaId)`.
- **Concurrencia limitada** en la cola: 10k medias en ráfaga puede pegarle al rate
  limit de Graph.
- **Estrategia por proveedor.** Twilio no usa este flujo — sus URLs de media piden
  Basic Auth con Account SID + Auth Token, y Twilio también borra el media con el
  tiempo. Kapso reenvía el payload de Meta pero hay que resolver con qué token se
  baja. Espeja el patrón de [messaging-api-strategy.service.ts](api/src/infrastructure/messaging/messaging-api-strategy.service.ts):
  un `MediaDownloadStrategy` con una implementación por proveedor.

---

## 8. Flujo 2 — Envío (upload del agente → WhatsApp)

### 8.1 Free — passthrough

```
El agente adjunta un archivo
    │
    ├─ POST /conversations/{id}/media  (multipart, atraviesa la API)
    │     ├─ validar tipo + tamaño contra los límites de WhatsApp
    │     ├─ buffer temporal en disco  (/tmp, con cleanup y guarda de disco lleno)
    │     ├─ POST /{phoneNumberId}/media   → media_id
    │     ├─ borrar el temporal
    │     └─ MediaAsset(status: 'meta_only', metaMediaId, metaExpiresAt)
    │
    └─ sendMessage({ type, mediaId, caption, filename })
```

Diferencias con el camino pago que hay que tener presentes:

- **No hay presigned PUT**: los bytes sí o sí pasan por el proceso de Node. Limitar
  el tamaño en el cliente antes de subir, y usar streaming (no cargar 100 MB en RAM).
- **Sin bytes guardados no hay reintento**: si el envío falla después del upload, el
  `media_id` sigue vivo 30 días, así que reintentar el *send* funciona. Pero si falla
  el upload, el agente tiene que volver a elegir el archivo.
- **Sin transcodificación** (§8.3) el archivo se manda tal cual → HEIC y GIF fallan.
  Como mínimo hay que **validar y explicar** antes de intentar: *"WhatsApp no acepta
  HEIC. Convertilo a JPG o pasate a Pro y lo hacemos nosotros."* Ese error es, en sí
  mismo, un punto de venta.
- **Sin reuso**: el mismo catálogo enviado a 50 clientes son 50 uploads a Meta.
  Se puede mitigar cacheando el `media_id` por `sha256` calculado al vuelo — barato
  y no requiere guardar nada.

### 8.2 Pago — con storage

```
UI: el agente arrastra un archivo / pega del portapapeles / elige de la biblioteca
    │
    ├─ A) archivo nuevo
    │     1. POST /media/upload-url  { filename, mimeType, sizeBytes }
    │           → valida tipo + tamaño + cuota
    │           → devuelve presigned PUT a  uploads/tmp/{uuid}
    │     2. el navegador sube DIRECTO a S3 (no pasa por el EC2)
    │     3. POST /media/commit { uploadId }
    │           → HEAD del objeto (verificar tamaño/tipo reales)
    │           → magic bytes, antivirus, sha256 → dedup
    │           → mover a  tenants/{tenantId}/...
    │           → transcodificar si hace falta (§8.3)
    │           → MediaAsset(status: 'ready')
    │
    └─ B) asset ya existente de la biblioteca → directo al paso siguiente

    4. POST /conversations/{id}/messages { mediaAssetId, caption, type }
         │
         ├─ ¿hay MediaProviderRef vivo para (asset, phoneNumberId)?
         │     sí → usar ese media_id
         │     no → stream S3 → POST /{phoneId}/media → guardar ref (TTL 25d)
         │
         └─ sendMessage({ type, mediaId, caption, filename })
```

**Detalles:**

- Subida **directa a S3 con presigned PUT** (multipart para >100 MB). Evita que
  archivos de 100 MB atraviesen el proceso de Node.
- **CORS del bucket** hay que configurarlo (`PUT`, `Content-Type`, origen de la UI).
- **Uploads huérfanos**: subidos pero nunca commiteados. Lifecycle rule que borra
  `uploads/tmp/` a las 24 h.
- **Nunca confiar en el nombre ni en la key que manda el cliente** — la key la
  genera el servidor. Path traversal es trivial si no.

### 8.3 Transcodificación — no es opcional

| Entrada | Problema | Acción |
|---|---|---|
| HEIC (iPhone) | WhatsApp no lo acepta | → JPEG |
| PNG/JPEG > 5 MB | Excede el límite | → redimensionar + recomprimir |
| GIF | No soportado | → MP4 (H.264 + pista de audio silenciosa) |
| WEBM (grabadora del navegador) | No soportado | → OGG/Opus para notas de voz |
| MOV / video > 16 MB | No soportado / excede | → MP4 H.264+AAC, recomprimido |
| MP4 multi-pista de audio | Meta lo rechaza | → remux a una sola pista |

Imágenes con **sharp** (in-process, liviano). Video/audio con **ffmpeg** — más pesado;
arrancar con un worker aparte o Lambda, y si en fase 1 no llega, **al menos validar y
dar un error claro en la UI** ("este video pesa 22 MB, WhatsApp acepta hasta 16 MB")
en vez de fallar contra Meta con un código numérico.

### 8.4 `media_id` vs campañas

Una campaña con header de imagen a 10.000 contactos: con `media_id` es **1 upload
por número de teléfono** y se reusa en todos los envíos. Es la diferencia entre una
campaña que sale en minutos y una que Meta estrangula. Hay que calentar el
`MediaProviderRef` **antes** de empezar el batch, no lazily en el primer envío
(si no, 50 workers en paralelo suben el mismo archivo 50 veces).

---

## 9. Flujo 3 — La Media Library (el producto, solo planes pagos)

### 9.1 La distinción que define si esto sirve o no

Mezclar todo en una sola grilla la vuelve inútil. Son **dos cosas distintas**:

**📚 Biblioteca** — curada, chica, reusable.
Logos, catálogos, listas de precios, menús, fotos de habitaciones, instructivos.
Es lo que aparece en el **selector** cuando el agente adjunta algo, cuando un flujo
configura `send_media`, cuando un template necesita header. Con carpetas y tags.
Se llena a mano, o marcando "guardar en biblioteca" sobre algo que llegó por chat.

**🕓 Historial** — todo lo que pasó por los números, potencialmente cientos de miles
de archivos. Es un **buscador**, no un selector. Filtros por tipo, fecha, contacto,
conversación, número, campaña, dirección (recibido/enviado), tamaño. Búsqueda por
nombre de archivo, caption, y —más adelante— OCR y transcripciones.

Una sola pantalla con dos pestañas. El mismo `MediaAsset`, distinguido por
`inLibrary: boolean`.

### 9.2 Pantallas

```
/media
├── Biblioteca                 grilla + carpetas + tags + subir + "usar en..."
├── Historial                  tabla/grilla con filtros y búsqueda
└── Uso                        cuánto ocupás, por tipo, tendencia, qué borrar
```

Detalle de un asset: preview, metadata, **en qué conversaciones apareció**, quién lo
subió, quién lo descargó (audit), acciones (descargar, reenviar a un contacto,
guardar en biblioteca, etiquetar, borrar, generar link público).

### 9.3 Integraciones dentro de la app

- **Bandeja**: el clip abre un menú → Galería / Documento / **Elegir de la biblioteca**.
  Drag & drop sobre el chat. Pegar desde el portapapeles. Grabar nota de voz.
- **Burbuja de mensaje**: render por tipo — imagen con lightbox, video con player,
  audio con waveform + duración (+ transcripción cuando exista), documento con
  ícono + nombre + tamaño + descarga, sticker.
- **Flujos**: `action.send_media` cambia el input de texto por un selector de la
  biblioteca (con "o pegá una URL externa" como opción). Nodo nuevo:
  **guardar el archivo recibido en la biblioteca con un tag** — matador para los
  verticales de hotel y turnos ("comprobante de pago", "foto del daño").
- **Templates**: al crear uno con header multimedia, se elige de la biblioteca y el
  backend hace la Resumable Upload para conseguir el `header_handle`. Esto
  **desbloquea una feature que hoy directamente no funciona**.
- **API pública** (`/v1`): `POST /v1/media` (upload), `GET /v1/media` (listar/buscar),
  `GET /v1/media/{id}` (metadata + URL firmada), y `POST /v1/messages` aceptando
  `mediaId`. Evento de webhook `media.ingested`.
- **Contacto**: pestaña "Archivos" con todo lo intercambiado con esa persona.

---

## 10. Storage como servicio: planes, cuotas, costos

### 10.1 Propuesta de planes

| | Free | Pro | Business | Agencies |
|---|---|---|---|---|
| Modo | **passthrough Meta** | almacenado | almacenado | almacenado |
| Storage incluido | — (0) | 25 GB | 250 GB | a medida |
| Retención | **30 días** (los de Meta) | 1 año | Ilimitada | Ilimitada |
| Overage | n/a | US$ 0,15/GB/mes | US$ 0,10/GB/mes | negociado |
| Media Library | ✗ | ✓ | ✓ | ✓ |
| Transcodificación automática | ✗ | ✓ | ✓ | ✓ |
| Rescate al upgradear (§4.3) | — | ✓ | ✓ | ✓ |
| Link público revocable | ✗ | ✓ | ✓ | ✓ |
| Transcripción de audios | ✗ | limitada | ✓ | ✓ |

Free **no tiene cuota de storage porque no usa storage**: usa el de Meta, con las
reglas de Meta. A los 30 días el archivo se evapora. Eso no es una limitación
artificial que inventamos nosotros — es la realidad de WhatsApp que hoy el cliente
sufre sin enterarse. Nuestro trabajo es **hacérsela visible en el momento justo**.

### 10.2 El motor de conversión

Tres puntos de contacto, todos honestos y todos en contexto:

1. **En la burbuja expirada** — donde estaba la foto: *"Este archivo ya no está
   disponible. WhatsApp lo guarda solo 30 días."* + link a planes.
2. **Un contador real en el dashboard** — sale gratis de tener la metadata (§4.2):
   *"Este mes recibiste 412 archivos (1,2 GB). 89 ya se perdieron."*
   Un número concreto convierte mucho más que un beneficio abstracto.
3. **El rescate al upgradear** (§4.3) — recuperamos los últimos 30 días en el acto.
   Es el único momento en que se puede, y eso lo vuelve urgente.

El error a evitar: mostrar el aviso de expiración como si fuera culpa nuestra. La
copy tiene que dejar claro que el límite es de WhatsApp y que nosotros somos la
solución, no el problema.

### 10.3 Regla de oro de las cuotas

**Nunca bloquear la ingesta de media entrante.** No podés decirle a un negocio "no
guardamos la foto que te mandó tu cliente porque llegaste al límite". Entonces:

- **Uploads salientes**: se bloquean al llegar al límite. Mensaje claro + upsell.
- **Ingesta entrante**: nunca se bloquea. Entra en **overage con gracia** y dispara
  aviso al 80 %, al 100 % y a los 7 días de overage sostenido. Después de la gracia,
  se factura el excedente (Pro/Business) o se aplica retención agresiva (Free).

Contador `tenant.storageUsedBytes` incremental + **job nocturno de reconciliación**
contra el tamaño real en S3 (los contadores incrementales derivan siempre).

### 10.4 Borrado y retención — más difícil de lo que parece

- Con **dedup por sha256**, un asset puede estar referenciado por N mensajes. Borrar
  un mensaje **no** borra el archivo. Hace falta `refCount` o un índice de referencias.
- Un asset referenciado por un **flujo publicado o un template aprobado** no se puede
  borrar aunque venza la retención. Hay que marcarlo como *pinned*.
- Vencimiento por retención: `expiresAt` en el asset + **S3 Lifecycle** como red de
  seguridad. Considerar tiering a Infrequent Access a los 90 días (más barato) y
  Glacier para "ilimitado" en Business.
- **Borrado por pedido del contacto (GDPR / Ley 25.326)**: hay que poder purgar todo
  el media de un contacto. Requiere `contactId` en el asset — ya está en el modelo.
  Ídem purga total al dar de baja un tenant.
- **Soft delete con papelera de 30 días** antes del borrado físico. La gente se
  equivoca.

### 10.5 Costos — la cuenta que hay que hacer antes de fijar precio

Con 1.000 tenants promediando 5 GB:

| Concepto | Cálculo | Mensual |
|---|---|---|
| Storage S3 Standard | 5 TB × US$ 0,023 | ~US$ 115 |
| **Egress** (agentes mirando archivos) | 2 TB × US$ 0,09 | **~US$ 180** |
| Requests (PUT/GET) | ~50 M | ~US$ 25 |
| Transcodificación | según volumen | variable |

**El egress es más caro que el storage.** Mitigaciones, en orden de impacto:

1. **Thumbnails.** Servir 20 KB en la grilla en vez de 3 MB. Corta el egress ~90 %.
2. **CloudFront** delante del bucket (egress más barato + caché).
3. **Cachear las URLs firmadas en el cliente** durante su TTL, no repedirlas por scroll.
4. **Cloudflare R2** si aun así domina: egress **gratis**, API compatible con S3.
   Por eso el `StoragePort` importa: es un cambio de adapter, no una reescritura.

---

## 11. Seguridad — donde esto se puede ir al demonio

1. **Nunca servir contenido de usuario desde `asis.chat`.** Un SVG o un HTML subido
   se convierte en XSS almacenado con las cookies de sesión de todos. Dominio
   separado (`media.asis.chat` o el dominio de CloudFront) + `Content-Disposition:
   attachment` + `X-Content-Type-Options: nosniff`.
2. **Bloquear SVG y HTML** en el upload, o forzarles `application/octet-stream`.
3. **Detectar el MIME por magic bytes**, jamás confiar en el `Content-Type` declarado
   ni en la extensión.
4. **Antivirus.** Los agentes van a abrir archivos que mandaron desconocidos.
   Mínimo: allowlist de extensiones. Mejor: ClamAV en el pipeline de commit, o
   GuardDuty Malware Protection for S3. Estado `quarantined` en el asset.
5. **Autorización en cada presign.** Verificar que el asset pertenece al tenant del
   JWT *antes* de firmar. Y considerar scoping por acceso al número
   ([AgentPhoneAccessRepository](api/src/domain/repositories/agent-phone-access.repository.js)):
   no todo agente debería ver todo lo que entró por todos los números.
6. **Keys generadas por el servidor**, siempre. Nada de paths que vengan del cliente.
7. **Bucket cerrado**: Block Public Access, SSE-S3 (o KMS por tenant en white-label),
   TLS obligatorio por policy, versioning + expiración de versiones viejas.
8. **Audit log** de descargas. Para un negocio que guarda documentos de clientes,
   "quién bajó qué" es requisito, no lujo. Espeja el patrón de `ConversationEvent`.
9. **Rate limit** en la generación de presigns (evitar que una cuenta comprometida
   exfiltre todo el historial en minutos).

---

## 12. Lo que te estás olvidando

Ordenado por cuánto duele descubrirlo tarde.

1. **Transcripción de notas de voz.** En LatAm la mitad de los mensajes son audios.
   Un agente no puede escuchar 80 audios para encontrar uno. Con el media guardado,
   Whisper convierte todo el historial en texto buscable — y le da al bot de IA la
   capacidad de *entender* audios en vez de responder "no puedo escuchar audios".
   Es, de lejos, **la feature de más valor que desbloquea este proyecto**. Diseñá el
   modelo con `transcript` desde el día uno aunque lo implementes en la fase 4.
2. **Visión para el bot de IA.** Un cliente manda la foto de un producto y el bot
   dice "no puedo ver imágenes". Con el asset en S3, se le pasa al modelo. Y a la
   inversa: una tool `send_media(assetId)` para que el bot mande el catálogo solo.
3. **Templates con header multimedia hoy no funcionan.** Falta toda la Resumable
   Upload API. No es "parte del media library", es un bug de producto que este
   proyecto arregla de paso. Vale la pena decirlo así internamente.
4. **El `media_id` es por número de teléfono.** Si no lo modelás desde el principio,
   la caché se rompe silenciosamente en cuanto un tenant agrega un segundo número.
5. **Falta `STICKER` en `MessageType`.** Los stickers entrantes se están perdiendo hoy.
6. **HEIC y GIF.** Sin transcodificación, un porcentaje alto de "mandar una foto"
   falla. Los usuarios no van a reportar "error de MIME", van a decir "no anda".
7. **Estado intermedio en la UI.** El mensaje aparece antes de que el archivo termine
   de bajar. Sin `mediaStatus: pending` + evento WS `media.ready`, se ve como un bug.
8. **Grabar audio desde el navegador** produce WEBM/Opus; WhatsApp quiere OGG/Opus.
   Transcodificación obligatoria o la feature no existe.
9. **Deduplicación.** El mismo catálogo PDF enviado en una campaña de 10.000 no
   pueden ser 10.000 objetos en S3. El `sha256` viene gratis en el webhook.
10. **El egress cuesta más que el storage.** Si fijás precio mirando solo US$/GB
    almacenado, el margen se evapora.
11. **Reconciliación de la cuota.** Los contadores incrementales siempre derivan.
    Job nocturno o el número que le mostrás al cliente miente.
12. **Papelera.** Sin soft delete, el primer borrado accidental de una carpeta es una
    llamada muy incómoda.
13. **Adapter local para dev y demo.** Si levantar la app requiere credenciales de
    AWS, se frena el desarrollo. Y el tenant demo no debería escribir en S3 real.
14. **Twilio y Kapso descargan distinto.** Twilio pide Basic Auth y también expira su
    media. Un `MediaDownloadStrategy` por proveedor desde el principio.
15. **Límites de tamaño distintos según el tipo.** Validar en el cliente *antes* de
    subir 100 MB para después rechazar.
16. **Preservar el `filename` original** de los documentos. Los agentes buscan por
    "presupuesto-final-v3.pdf", no por un UUID.
17. **Permisos.** ¿Un agente junior ve todos los documentos que recibió la empresa?
    Probablemente no. Scoping por número de teléfono como mínimo.
18. **`User-Agent` obligatorio** en la descarga desde Meta. Sin él, 400 sin explicación.
19. **Content-Type correcto al guardar en S3.** Si algún día usás `link:`, un
    Content-Type mal seteado hace que Meta rechace con un error incomprensible.
20. **Códigos de error de media de Meta** (131052 descarga, 131053 subida) deberían
    mapearse a los campos `waErrorCode`/`waErrorMessage` que ya existen en `Message`,
    con un mensaje traducido en la UI.
21. **OCR de documentos.** Fase lejana, pero convierte "3.000 PDFs" en un buscador
    real. Igual que con `transcript`, dejá el campo en el modelo.
22. **Exportación masiva.** "Quiero bajarme todo mi media" — de un tenant que se va,
    o por auditoría. Un ZIP generado async. Es también la respuesta honesta al miedo
    del lock-in.
23. **Backup y durabilidad.** Versioning en S3 + expiración de versiones no actuales.
    Replicación cross-region para Business/white-label si se promete "para siempre".
24. **Reenviar entre conversaciones.** "Mandale a este otro cliente el mismo PDF" —
    con la biblioteca es trivial, pero hay que ponerlo en la UI.

### Nuevos, a partir de la decisión "Free = passthrough"

25. **El proxy puede hacer que te throttlee Meta — a nivel WABA.** Es el riesgo más
    serio del modelo Free. Un agente scrolleando dispara decenas de descargas contra
    Graph, y el rate limit de media es compartido con el resto de la API de ese
    número. Sin `Cache-Control` + `ETag` + rate limit propio, un tenant Free ruidoso
    puede degradarle el envío de mensajes a su propio número. **No es opcional.**
26. **El rescate al upgradear es tu mejor momento de onboarding** — y es irrepetible.
    Los archivos de hace 31 días no vuelven nunca. Si no construís el backfill, el
    cliente paga y no ve absolutamente nada distinto hasta que le llegue el próximo
    archivo. Enorme diferencia en percepción de valor por poco código.
27. **El downgrade necesita política escrita antes de shipear el upgrade.**
    Nadie piensa en esto hasta que el primer cliente cancela y hay que decidir en
    caliente si le borrás 40 GB. Ventana de lectura + avisos + export (§4.4).
28. **Campañas con media en Free se rompen solas.** El `media_id` vive 30 días; sin
    bytes guardados, una campaña recurrente o un reintento posterior no tiene de
    dónde regenerarlo. Dos salidas: campañas con media son feature paga, o guardamos
    los assets de campaña incluso en Free (son pocos y acotados). Hay que elegir.
29. **Templates con header multimedia sí pueden funcionar en Free**, porque la
    Resumable Upload API también es passthrough (subís, te da el `header_handle`, no
    guardás nada). No lo bloquees por reflejo.
30. **Visión del bot y transcripción también son técnicamente posibles en Free**
    (bajás de Meta al vuelo, procesás, tirás los bytes). Su costo es de tokens, no de
    storage — así que gatearlas por plan es una decisión comercial separada, no una
    consecuencia técnica de esta arquitectura.
31. **Sin storage no hay dedup, pero sí hay caché.** En Free, el mismo PDF enviado a
    50 clientes son 50 uploads a Meta. Calculando el `sha256` al vuelo y cacheando
    `(sha256, phoneNumberId) → media_id` se evita, sin guardar un solo byte.
32. **Si `if (plan === 'free')` aparece fuera de la estrategia, perdiste.** El día que
    esa condición se filtre a la burbuja del chat, a las campañas y a los flujos,
    tenés dos productos que mantener en paralelo. Todo detrás de `MediaAccessPort`.

---

## 13. Fases

El orden importa: **el passthrough va primero y no necesita nada de infra.** Sin S3,
sin Terraform, sin bucket. Arregla el media —que hoy está roto para todos— y se
puede shipear en una semana. El storage se apoya encima después.

**Fase 1 — Passthrough** (el media funciona, para todos, con cero infra nueva)
- `MediaAsset` + repo · `MediaAccessPort` con la estrategia passthrough
- `MessageType.STICKER` · arreglar el parser (guardar `mediaId`, no la URL trucha)
- Proxy `GET /media/:id/raw` con caché, ETag, rate limit y headers de seguridad
- Render en la burbuja: imagen, video, audio, documento, sticker + estado expirado
- Adjuntar en la bandeja: upload → Meta → `media_id` → enviar
- Validación de tipo/tamaño con mensajes de error que se entienden

**Fase 2 — Storage para planes pagos** (el archivo deja de morir a los 30 días)
- `StoragePort` + adapters S3 y local · Terraform del bucket · CORS · lifecycle
- `MEDIA_INGEST_JOB` con reintentos + `MediaDownloadStrategy` por proveedor
- Presigned GET/PUT + commit + validación (magic bytes, antivirus básico)
- Thumbnails (sharp) · transcodificación de imágenes (HEIC→JPEG, downscale)
- `MediaProviderRef` (caché de `media_id` por número)
- **Job de backfill al upgradear** + rescate de los últimos 30 días con progreso
- Cuotas, medición y avisos · política de downgrade

**Fase 3 — La biblioteca** (el producto que se vende)
- Pantalla `/media` con pestañas Biblioteca / Historial / Uso
- Carpetas, tags, búsqueda, filtros · selector desde la bandeja
- Retención + lifecycle + papelera · exportación masiva
- Selector en `action.send_media` de flujos
- Pantalla "Uso" en Free como motor de conversión (§10.2)

**Fase 4 — Integraciones**
- Resumable Upload API → templates con header multimedia
- Media en la API pública `/v1` + evento `media.ingested`
- Exportación masiva (ZIP) · audit log de descargas

**Después (fuera del alcance actual):** transcripción, OCR, visión del bot,
transcodificación de video/audio, notas de voz desde el navegador.

---

## 14. Decisiones — todas cerradas

- **Free = passthrough contra Meta.** No guardamos bytes: subimos para enviar y
  proxeamos para ver. A los 30 días el archivo se pierde, y eso es el argumento de
  venta.
- **Media Library = solo planes pagos.**
- **En planes pagos, enviar siempre por `media_id`, nunca por `link`.** Bucket privado.
- **La metadata del asset se guarda en todos los planes**, incluido Free.
- **El passthrough se construye primero** (fase 1), sin nada de infra nueva.
- **Campañas con media: solo planes pagos.** Free no puede adjuntar media a una
  campaña ni usar templates con header multimedia en campañas. Cierra la única
  grieta del passthrough (el `media_id` vencido sin bytes para regenerarlo).
- **S3, no R2.** Ya estamos en AWS; un proveedor menos que operar. El `StoragePort`
  deja la migración abierta si el egress se vuelve el costo dominante.
- **Cuotas**: Pro 25 GB · Business 250 GB · Agencies a medida. **Sin facturación de
  overage por ahora** — al llegar al límite se bloquean los uploads salientes y se
  avisa; la ingesta entrante nunca se bloquea. Facturar GB extra requiere tocar el
  proveedor de pagos y no vale la pena hasta tener datos de uso real.
- **Ventana post-downgrade: 60 días** de lectura, con avisos a los 30/7/1 y export.
- **Permisos: los agentes ven solo el media de los números a los que tienen acceso**
  (`AgentPhoneAccessRepository`, que ya existe). Los admins del tenant ven todo.
  Es el default seguro y no cuesta más implementarlo así desde el principio.
- **Sin ffmpeg.** Transcodificación solo de imágenes con `sharp` (downscale,
  recompresión, thumbnails). Video y audio se validan y, si no cumplen, se rechazan
  con un mensaje que se entiende. Meter ffmpeg en el contenedor por un caso borde no
  se justifica todavía.
- **Sin HEIC en fase 1.** iOS ya convierte a JPEG en la mayoría de los uploads desde
  el navegador. Si igual llega un HEIC, error claro. Se agrega cuando aparezca de
  verdad en los logs.
- **Sin antivirus.** En su lugar: allowlist estricta de MIME (solo lo que WhatsApp
  acepta), detección por magic bytes, `Content-Disposition: attachment` en
  documentos, `nosniff`, y nunca servir HTML ni SVG. Cubre el riesgo real sin sumar
  ClamAV a la infra.

### Fuera de alcance (por decisión explícita)

Transcripción de audios, OCR, visión del bot de IA y cualquier enriquecimiento
automático. La biblioteca primero; lo demás se apoya encima cuando exista.

---

## 15. Qué quedó construido

Fases 1 a 3 completas. `npm test` en `api/` pasa (106 tests), `tsc --noEmit` limpio
en API y UI, `next build` verde.

### Backend

| Capa | Archivos |
|---|---|
| Dominio | [media-asset.entity.ts](api/src/domain/entities/media-asset.entity.ts) · [media-provider-ref.entity.ts](api/src/domain/entities/media-provider-ref.entity.ts) · [media-constraints.ts](api/src/domain/constants/media-constraints.ts) · [mime-sniffer.ts](api/src/domain/services/mime-sniffer.ts) · [media-errors.ts](api/src/domain/errors/media-errors.ts) · enums `MediaKind`/`MediaAssetStatus`/`MediaSource` |
| Persistencia | [media-asset.schema.ts](api/src/infrastructure/persistence/mongoose/schemas/media-asset.schema.ts) · [mongo-media-asset.repository.ts](api/src/infrastructure/persistence/mongoose/repositories/mongo-media-asset.repository.ts) · [mongo-media-provider-ref.repository.ts](api/src/infrastructure/persistence/mongoose/repositories/mongo-media-provider-ref.repository.ts) |
| Proveedores | [meta-media-api.service.ts](api/src/infrastructure/messaging/meta-media-api.service.ts) (Meta + Kapso) · [twilio-media-api.service.ts](api/src/infrastructure/messaging/twilio-media-api.service.ts) · [media-provider-strategy.service.ts](api/src/infrastructure/messaging/media-provider-strategy.service.ts) · [media-payload.builder.ts](api/src/infrastructure/messaging/media-payload.builder.ts) |
| Storage | [s3-storage.service.ts](api/src/infrastructure/storage/s3-storage.service.ts) · [local-disk-storage.service.ts](api/src/infrastructure/storage/local-disk-storage.service.ts) · [disabled-storage.service.ts](api/src/infrastructure/storage/disabled-storage.service.ts) · [image-processor.service.ts](api/src/infrastructure/storage/image-processor.service.ts) · [media-url-signer.service.ts](api/src/infrastructure/storage/media-url-signer.service.ts) |
| Aplicación | [media-access.service.ts](api/src/application/use-cases/media/media-access.service.ts) · [media-storage.service.ts](api/src/application/use-cases/media/media-storage.service.ts) · [upload-media.use-case.ts](api/src/application/use-cases/media/upload-media.use-case.ts) · [ingest-media-asset.use-case.ts](api/src/application/use-cases/media/ingest-media-asset.use-case.ts) · [backfill-tenant-media.use-case.ts](api/src/application/use-cases/media/backfill-tenant-media.use-case.ts) · [media-maintenance.use-case.ts](api/src/application/use-cases/media/media-maintenance.use-case.ts) |
| API | [media.controller.ts](api/src/presentation/controllers/media.controller.ts) · [media-job.processor.ts](api/src/infrastructure/queue/media-job.processor.ts) |
| Infra | [media.tf](infra/terraform/media.tf) — bucket privado, TLS obligatorio, versioning, lifecycle, CORS, IAM |

### Frontend

[message-media.tsx](ui/src/components/chat/message-media.tsx) ·
[attachment-preview.tsx](ui/src/components/chat/attachment-preview.tsx) ·
[media-picker-dialog.tsx](ui/src/components/media/media-picker-dialog.tsx) ·
[app/(app)/media/page.tsx](ui/src/app/(app)/media/page.tsx) +
[media-card](ui/src/app/(app)/media/_components/media-card.tsx) /
[media-usage-panel](ui/src/app/(app)/media/_components/media-usage-panel.tsx) ·
[media.store.ts](ui/src/stores/media.store.ts) · [lib/media.ts](ui/src/lib/media.ts)

### Decisiones tomadas durante la implementación

- **El uso de storage se calcula por agregación, no con un contador denormalizado.**
  Evita el job nocturno de reconciliación y el número que se le muestra al cliente
  nunca miente. A esta escala el costo de la agregación es despreciable.
- **El upload del agente pasa por la API, no por presigned PUT.** El passthrough lo
  necesita igual (los bytes tienen que ir a Meta desde el servidor), y un solo
  camino para los dos planes evita bifurcar la lógica. El presigned PUT queda como
  optimización futura para archivos grandes: el bucket ya tiene el CORS puesto.
- **El archivo se sube recién al apretar enviar**, no al elegirlo. Si el agente se
  arrepiente no queda basura en el storage ni se consume cuota.
- **La deduplicación por `sha256` vale en los dos planes**: con storage evita
  duplicar objetos en S3, y en passthrough evita volver a subir a Meta el mismo
  archivo. Sale gratis porque el hash ya viene en el webhook.
- **`MessageMediaEnricher`** resuelve las URLs de los adjuntos en el listado de
  mensajes y en los eventos de WebSocket. Las URLs son de corta vida a propósito,
  así que se firman por request en vez de guardarse.
- **Un `MediaAsset` de biblioteca no se ata a un mensaje.** El vínculo vive en
  `Message.mediaAssetId`: el mismo catálogo se manda a muchos contactos.
- **"El plan no incluye biblioteca" y "no hay storage configurado" son estados
  distintos** y la UI dice cosas distintas en cada uno. Confundirlos hacía que un
  tenant Business en un entorno sin bucket viera un upsell que no arreglaba nada.
  `MediaAccessService.capabilities()` devuelve `planIncludesLibrary` y
  `storageConfigured` por separado, y el backend loguea un warning cuando el plan
  alcanza pero falta la config.

### Planes: la regla es una sola

`effectivePlan()` en [plan-resolution.util.ts](api/src/application/use-cases/billing/plan-resolution.util.ts)
es la única fuente de verdad. Antes la expresión estaba copiada a mano en 7 lugares
y una copia se había olvidado de mirar el estado de la suscripción, así que la
pantalla de uso mostraba "Business" con los límites de Free.

Incluye una **ventana de gracia de 3 días para `past_due`**: el webhook de
renovación no llega en el mismo instante en que vence el período, y sin esa
ventana un cliente que pagó se quedaba sin números, sin bots y sin biblioteca por
una demora que es nuestra, no suya.

### Pendiente (fase 4)

- Resumable Upload API → templates con header multimedia
- Media en la API pública `/v1` + evento `media.ingested`
- Exportación masiva (ZIP) y audit log de descargas
- Papelera con UI (el soft delete ya está; falta la pantalla para restaurar)
- Avisos por mail de cuota al 80/100% y de la ventana post-downgrade
