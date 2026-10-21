# API de notificaciones de asis.chat

Guía de arranque para un desarrollador externo: cómo crear una notificación
(mensaje de WhatsApp con plantilla), seguir su estado y recibir avisos por
webhook, sin ayuda de nadie.

- **Base de la API:** `https://TU_DOMINIO/api` (en desarrollo local: `http://localhost:3000/api`)
- **Prefijo de la API pública:** `/v1`
- **Formato:** JSON en request y response. Fechas en ISO 8601 con offset (`2026-10-19T15:30:00-03:00`).

> Todos los ejemplos usan datos ficticios. Las claves de este documento son
> placeholders (`ak_test_TU_CLAVE`, `ak_live_TU_CLAVE`): no copies ninguna clave
> real a un repositorio, a un chat o a un ticket.

---

## 1. Qué es una notificación

Una **notificación** es un mensaje de WhatsApp con plantilla que tu backend
pide a asis.chat y después sigue. asis.chat se encarga de resolver la
ventana de 24 horas, la plantilla, la cola y el estado; vos solo pedís
"mandá esto a este número" y después consultás o te avisamos por webhook.

Una notificación tiene un **id propio** (`ntf_...`) y un **estado**:

```
scheduled → queued → sent → delivered → read
                  ↘ failed
    ↘ canceled
```

- `scheduled`: guardada, con hora de envío futura.
- `queued`: aceptada, esperando salir.
- `sent`: salió a Meta (o se simuló en sandbox).
- `delivered`: Meta la entregó.
- `read`: el destinatario la leyó.
- `failed`: no se pudo enviar (mirá `failureCode` y `failureReason`).
- `canceled`: se canceló antes de salir.

Si lo que querés es una conversación (respuesta en formato libre, atención de
un agente, automatizaciones) usá `POST /api/v1/messages` y los webhooks
`message.*`. Las notificaciones son para **mensajes salientes de la empresa**
con plantilla: turnos, pedidos, avisos de pago.

---

## 2. Antes de empezar

Necesitás, en asis.chat:

1. Un plan con **API habilitada** (en el panel: *Desarrolladores → Claves de API*).
2. Un **número de WhatsApp** conectado y activo.
3. Al menos una **plantilla aprobada por Meta** (utility o authentication).
   Las plantillas de marketing necesitan que el destinatario haya dado
   consentimiento: sin eso, la API responde `422` con `MARKETING_OPT_OUT`.

Para ver tus plantillas aprobadas:

```bash
curl "https://TU_DOMINIO/api/v1/templates?limit=50" \
  -H "X-Api-Key: ak_test_TU_CLAVE"
```

Cada plantilla viene con `id`, `name`, `language` y `phoneNumberId`.

---

## 3. Autenticación

Todas las llamadas van con el header `X-Api-Key` (también podés mandar
`Authorization: Bearer ak_...`).

```bash
-H "X-Api-Key: ak_test_TU_CLAVE"
```

### 3.1 Live vs Test: dos prefijos, dos comportamientos

El prefijo de la clave dice para qué sirve:

| Prefijo   | Modo  | Qué hace                                                    |
| --------- | ----- | ----------------------------------------------------------- |
| `ak_live_`| live  | Envía de verdad a Meta. Se cobra según tu plan.              |
| `ak_test_`| test  | **No llega a Meta y no genera costo.** Todo se resuelve en el sandbox. |

Una clave **test** no toca Meta: la notificación se crea, se encola, avanza de
estado y dispara webhooks igual que una real, pero el mensaje no sale hacia
ningún destinatario y no se cobra. Es el modo para developing, QA y demos.

La misma regla vale para el resto de la API: si con una clave test llamás a
`POST /v1/messages` o respondés una conversación, el mensaje se simula local y
no se manda a WhatsApp. Una clave test nunca alcanza a Meta.

> Los estados del sandbox son simulados: una notificación de test puede
> aparecer como `delivered` aunque nadie la haya recibido.

Creás las claves en el panel (*Desarrolladores → Claves de API*): cada clave
nace en modo **Test** si lo dejás así, y el panel muestra el modo de cada
clave con una etiqueta `TEST` o `LIVE`.

### 3.2 Permisos de la clave

Cada clave tiene permisos (`scopes`). Las notificaciones usan dos:

| Permiso               | Para qué                                                  |
| --------------------- | --------------------------------------------------------- |
| `notifications:write` | Crear y cancelar notificaciones.                          |
| `notifications:read`  | Consultar el detalle, el timeline y el listado.            |

Si a tu clave le falta un permiso, la API responde `403` con el código
`MISSING_SCOPE` y te dice exactamente cuáles tenés y cuáles te faltan
(`granted` y `required` en el cuerpo del error). Se cambian en el panel, en
la misma pantalla donde creaste la clave: en el formulario de alta, marcá
`notifications:read` y `notifications:write` (y `messages:read` si además
querés listar plantillas y números con la misma clave).

### 3.3 Chequeo de conectividad

```bash
curl "https://TU_DOMINIO/api/v1/me" \
  -H "X-Api-Key: ak_test_TU_CLAVE"
```

```json
{
  "tenant": { "id": "66f0a1b2c3d4e5f60718293a", "name": "Mi empresa" },
  "apiKey": { "id": "66f0a1b2c3d4e5f60718293b", "name": "backend local" },
  "plan": "pro"
}
```

---

## 4. Crear una notificación

`POST /api/v1/notifications` → **202 Accepted**

El `202` significa "aceptada, todavía no enviada": la consulta el estado
después con `GET /api/v1/notifications/:id` o te avisamos por webhook.

### 4.1 El header `Idempotency-Key` es obligatorio

Cada notificación lleva un `Idempotency-Key` **único**:

- Si el servidor se cae y reintentás, mandás **la misma** clave y recibís la
  misma notificación (no se duplica el mensaje).
- Si reusás una clave con **otro cuerpo**, la API responde `409`
  `IDEMPOTENCY_KEY_REUSED`.

Regla práctica: `idempotencyKey = <id de tu orden o tarea>:<intento>`, o un
UUID por solicitud. Máximo 255 caracteres.

```bash
curl -X POST "https://TU_DOMINIO/api/v1/notifications" \
  -H "X-Api-Key: ak_test_TU_CLAVE" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: notif-2026-10-19-0001" \
  -d '{
    "to": "+5491100000000",
    "templateId": "000000000000000000000000",
    "variables": { "nombre": "Ana", "fecha": "2026-10-20" },
    "metadata": { "ordenId": "A-1042" }
  }'
```

### 4.2 Body

| Campo           | Tipo   | Obligatorio | Qué es                                                              |
| --------------- | ------ | ----------- | ------------------------------------------------------------------- |
| `to`            | string | sí          | Destinatario en formato internacional (`+5491100000000`).           |
| `templateId`    | string | sí\*        | Id de la plantilla aprobada.                                        |
| `template`      | object | sí\*        | Alternativa al id: `{ "name": "turno_confirmado", "language": "es" }`. |
| `variables`     | object | no          | Variables de la plantilla. Los números se guardan como texto.        |
| `sendAt`        | string | no          | ISO 8601 con offset. Si no viene, sale ahora.                       |
| `metadata`      | object | no          | Datos libres tuyos. Se devuelven en el detalle (máx. 4000 caracteres). |
| `phoneNumberId` | string | no          | Número emisor. Opcional si la cuenta tiene uno solo activo.         |

\* Hay que mandar `templateId` **o** `template`, no los dos.

### 4.3 Respuesta `202`

```json
{
  "id": "ntf_8f2c1a9b4d7e",
  "status": "queued",
  "sendAt": null,
  "sandbox": true
}
```

- `id`: el id de la notificación. Guardalo.
- `status`: el estado en el momento de aceptarla.
- `sendAt`: cuándo sale. Si mandaste `sendAt`, viene esa hora; si el envío es
  inmediato puede venir `null`.
- `sandbox`: `true` si la clave es de test. Si mandaste con una clave test y
  esto dice `false`, estás usando la clave equivocada.

---

## 5. Consultar el estado y el timeline

`GET /api/v1/notifications/:id` → **200**

```bash
curl "https://TU_DOMINIO/api/v1/notifications/ntf_8f2c1a9b4d7e" \
  -H "X-Api-Key: ak_test_TU_CLAVE"
```

```json
{
  "id": "ntf_8f2c1a9b4d7e",
  "status": "delivered",
  "to": "+5491100000000",
  "templateId": "000000000000000000000000",
  "templateName": "turno_confirmado",
  "sandbox": true,
  "metadata": { "ordenId": "A-1042" },
  "createdAt": "2026-10-19T15:29:58.000Z",
  "sendAt": "2026-10-19T15:30:00.000Z",
  "queuedAt": "2026-10-19T15:30:00.000Z",
  "sentAt": "2026-10-19T15:30:01.000Z",
  "deliveredAt": "2026-10-19T15:30:04.000Z",
  "readAt": null,
  "failedAt": null,
  "failureCode": null,
  "failureReason": null,
  "timeline": [
    { "status": "scheduled", "at": "2026-10-19T15:29:58.000Z", "detail": null },
    { "status": "queued",    "at": "2026-10-19T15:30:00.000Z", "detail": null },
    { "status": "sent",      "at": "2026-10-19T15:30:01.000Z", "detail": null },
    { "status": "delivered", "at": "2026-10-19T15:30:04.000Z", "detail": null }
  ]
}
```

`timeline` es la historia de lo que le pasó a la notificación, en orden. Si
falló, `failureCode` y `failureReason` te dicen por qué.

---

## 6. Listar notificaciones

`GET /api/v1/notifications` → **200**

```bash
curl "https://TU_DOMINIO/api/v1/notifications?status=delivered&from=2026-10-01T00:00:00-03:00&limit=50" \
  -H "X-Api-Key: ak_test_TU_CLAVE"
```

| Parámetro   | Tipo   | Qué es                                                        |
| ----------- | ------ | ------------------------------------------------------------- |
| `status`    | string | `scheduled`, `queued`, `sent`, `delivered`, `read`, `failed`, `canceled`. |
| `templateId`| string | Filtra por plantilla.                                         |
| `from`      | string | ISO 8601 inclusive: desde cuándo.                             |
| `to`        | string | ISO 8601 inclusive: hasta cuándo.                             |
| `page`      | number | Página, desde 1. Por defecto 1.                               |
| `limit`     | number | Cuántas por página. Máximo 100. Por defecto 20.               |

```json
{
  "data": [ { "id": "ntf_8f2c1a9b4d7e", "status": "delivered", "...": "..." } ],
  "meta": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

Las notificaciones salen de la más nueva a la más vieja.

---

## 7. Cancelar una notificación programada

`POST /api/v1/notifications/:id/cancel` → **200**

```bash
curl -X POST "https://TU_DOMINIO/api/v1/notifications/ntf_8f2c1a9b4d7e/cancel" \
  -H "X-Api-Key: ak_test_TU_CLAVE"
```

```json
{ "id": "ntf_8f2c1a9b4d7e", "status": "canceled" }
```

Solo se puede cancelar una notificación que **todavía no salió** (estado
`scheduled`). Si ya salió, la API responde `409` con
`NOTIFICATION_NOT_CANCELABLE`: el mensaje ya está en Meta y no se puede dar
marcha atrás.

---

## 8. Catálogo de errores

Todos los errores de la API vienen con el mismo formato:

```json
{ "code": "NOTIFICATION_NOT_CANCELABLE", "message": "..." }
```

El `code` es estable: podés ramificar tu código con él. El `message` es para
humanos y puede cambiar.

| Código                     | HTTP | Qué pasó                                              | Qué hacer                                                                 |
| -------------------------- | ---- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `MISSING_IDEMPOTENCY_KEY`  | 400  | Falta el header `Idempotency-Key`.                    | Mandá el header. Es obligatorio en cada alta.                               |
| `INVALID_IDEMPOTENCY_KEY`  | 400  | El `Idempotency-Key` supera los 255 caracteres.       | Acortalo.                                                                  |
| `MISSING_SCOPE`            | 403  | A la clave le falta un permiso.                       | Mirá `required` y `granted` en el error y dá el permiso en el panel.        |
| `FEATURE_NOT_IN_PLAN`      | 403  | Tu plan no tiene la API habilitada.                  | Cambiá de plan.                                                            |
| `RATE_LIMIT_EXCEEDED`      | 429  | Superaste el límite de requests por minuto de la clave. | Esperá y reintentá con backoff. El mensaje dice cuántos segundos.        |
| `INVALID_METADATA`         | 422  | `metadata` supera los 4000 caracteres.                | Achicá el JSON que mandás en `metadata`.                                   |
| `INVALID_SEND_AT`          | 422  | `sendAt` no es una fecha ISO 8601 válida.             | Mandá `sendAt` con offset (`-03:00`) o en UTC (`Z`).                       |
| `NOTIFICATION_NOT_FOUND`   | 404  | La notificación no existe o no es de tu cuenta.      | Revisá el id. Un id de otra cuenta también responde 404.                   |
| `IDEMPOTENCY_KEY_REUSED`   | 409  | Reusaste un `Idempotency-Key` con otro cuerpo.        | Usá una clave de idempotencia nueva por notificación.                     |
| `NOTIFICATION_NOT_CANCELABLE` | 409 | La notificación ya salió: no se puede cancelar.    | No hagas nada: la notificación sigue su curso.                             |
| `NOTIFICATION_ALREADY_SENT`| 409  | La notificación ya fue enviada.                      | No hagas nada.                                                             |
| `TEMPLATE_NOT_APPROVED`    | 422  | La plantilla todavía no está aprobada por Meta.       | Esperá la aprobación y reintentá más tarde.                                |
| `TEMPLATE_NOT_FOUND`       | 422  | El `templateId` no existe.                            | Revisá el id contra `GET /api/v1/templates`.                               |
| `MISSING_TEMPLATE_VARIABLES` | 422 | Faltan variables que la plantilla necesita.           | Completá `variables` con todas las que pida la plantilla.                  |
| `INVALID_PHONE`            | 422  | El `to` no es un teléfono válido.                     | Mandalo en formato internacional, con `+`.                                 |
| `INVALID_RECIPIENT`        | 422  | El destinatario no es alcanzable.                     | Revisá el número.                                                          |
| `TEMPLATE_PHONE_MISMATCH`  | 422  | La plantilla no pertenece al número emisor.           | Usá el `phoneNumberId` de la plantilla o quitá el `phoneNumberId`.          |
| `PHONE_NUMBER_NOT_FOUND`   | 422  | El `phoneNumberId` no existe.                         | Revisá el id contra `GET /api/v1/phone-numbers`.                           |
| `PHONE_NUMBER_AMBIGUOUS`   | 422  | La cuenta tiene varios números y no indicaste cuál.   | Mandá `phoneNumberId`.                                                     |
| `PHONE_NUMBER_INACTIVE`    | 422  | El número emisor no está activo.                      | Conectalo y activalo en el panel.                                          |
| `MARKETING_OPT_OUT`        | 422  | El destinatario pidió no recibir mensajes.            | No reintentes: respetá la baja.                                            |
| `AUTH_TEMPLATE_REQUIRES_PHONE` | 422 | La plantilla de autenticación necesita el teléfono. | Mandá `to` con el teléfono del destinatario.                                |
| `NOTIFICATION_NOT_CREATED` | 500  | No se pudo crear la notificación.                    | Reintentá con un `Idempotency-Key` nuevo y avisá si insiste.                |

---

## 9. Webhooks: enterate sin consultar

En vez de consultar el estado cada tanto, registrá un endpoint en
*Desarrolladores → Webhooks* y suscribilo a los eventos de notificación.

### 9.1 Eventos

| Evento                    | Cuándo se dispara                                     |
| ------------------------- | ----------------------------------------------------- |
| `notification.scheduled`  | La notificación quedó agendada (o fue creada sin `sendAt`). |
| `notification.sent`       | Salió a Meta (o se simuló en sandbox).                 |
| `notification.delivered`  | Meta la entregó.                                      |
| `notification.read`       | El destinatario la leyó.                              |
| `notification.failed`     | No se pudo enviar.                                    |
| `notification.canceled`   | Se canceló antes de salir.                            |

### 9.2 Payload

```json
{
  "id": "evt_9a8b7c6d5e4f",
  "type": "notification.delivered",
  "createdAt": "2026-10-19T15:30:04.000Z",
  "data": {
    "id": "ntf_8f2c1a9b4d7e",
    "status": "delivered",
    "to": "+5491100000000",
    "templateId": "000000000000000000000000",
    "templateName": "turno_confirmado",
    "sandbox": true,
    "metadata": { "ordenId": "A-1042" },
    "createdAt": "2026-10-19T15:29:58.000Z",
    "sendAt": "2026-10-19T15:30:00.000Z",
    "sentAt": "2026-10-19T15:30:01.000Z",
    "deliveredAt": "2026-10-19T15:30:04.000Z",
    "readAt": null,
    "failedAt": null,
    "failureCode": null,
    "failureReason": null
  }
}
```

### 9.3 Verificar que el webhook sea tuyo

Cada entrega viene firmada:

| Header               | Qué es                                                     |
| -------------------- | ---------------------------------------------------------- |
| `X-Asis-Event`       | Tipo de evento (`notification.delivered`).                 |
| `X-Asis-Event-Id`    | Id del evento.                                             |
| `X-Asis-Delivery-Id` | Id de la entrega (útil para deduplicar).                   |
| `X-Asis-Signature`   | `t=<timestamp>,v1=<firma>` en hex.                         |

La firma es un HMAC-SHA256 del secreto de tu endpoint sobre
`"<timestamp>.<body>"`, en hexadecimal. Verificá que el timestamp sea
reciente (5 minutos) y que la firma calcule. Si no coincide, ignorá el
evento: no es de tu cuenta.

Las entregas que fallan se reintentan solas. Respondé `2xx` rápido: si tu
endpoint tarda, se reintenta y podés recibir el mismo evento dos veces.
Guardá el `X-Asis-Event-Id` para deduplicar.

---

## 10. Ejemplo completo con curl

Flujo de punta a punta con una clave **test** (no llega a Meta, no se cobra):

```bash
BASE="https://TU_DOMINIO/api"
KEY="ak_test_TU_CLAVE"

# 1. Chequeo de conectividad
curl -s "$BASE/v1/me" -H "X-Api-Key: $KEY"

# 2. Crear la notificación (Idempotency-Key única)
curl -s -X POST "$BASE/v1/notifications" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: notif-2026-10-19-0001" \
  -d '{
    "to": "+5491100000000",
    "template": { "name": "turno_confirmado", "language": "es" },
    "variables": { "nombre": "Ana", "fecha": "2026-10-20" },
    "metadata": { "ordenId": "A-1042" }
  }'
# => { "id": "ntf_8f2c1a9b4d7e", "status": "queued", "sendAt": null, "sandbox": true }

# 3. Consultar el estado
curl -s "$BASE/v1/notifications/ntf_8f2c1a9b4d7e" -H "X-Api-Key: $KEY"

# 4. Listar las últimas
curl -s "$BASE/v1/notifications?limit=5" -H "X-Api-Key: $KEY"

# 5. Programar una para más adelante y cancelarla
curl -s -X POST "$BASE/v1/notifications" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: notif-2026-10-19-0002" \
  -d '{
    "to": "+5491100000000",
    "template": { "name": "turno_confirmado", "language": "es" },
    "variables": { "nombre": "Ana", "fecha": "2026-10-20" },
    "sendAt": "2026-10-20T09:00:00-03:00"
  }'

curl -s -X POST "$BASE/v1/notifications/ntf_8f2c1a9b4d7e/cancel" \
  -H "X-Api-Key: $KEY"
```

---

## 11. Probar en sandbox y pasar a producción

1. **Creá una clave de test** en el panel (*Desarrolladores → Claves de API*,
   modo `TEST`). Se ve en la lista con la etiqueta `TEST`.
2. **Hacé el flujo completo** con esa clave: crear, consultar, cancelar,
   webhook. Nada sale a Meta y nada se cobra.
3. **Revisá la consola de notificaciones** del panel: la misma notificación
   aparece con su estado, su timeline y la marca de sandbox.
4. Cuando tu integración esté probada, **creá una clave live** (etiqueta
   `LIVE`) y cambiala en tu configuración. A partir de ahí los envíos salen de
   verdad y se cobran según tu plan.
5. **No reutilices la clave live en desarrollo.** Es lo primero que se filtra.

Reglas de higiene:

- La clave completa se muestra **una sola vez**, al crearla. Si la perdés,
  revocá la clave y creá otra.
- No la mandes desde el navegador ni la embebas en el front: todo el traffic
  de notificaciones tiene que salir de tu backend.
- Guardala en un secret manager o en variables de entorno.

---

## 12. Límites y detalles que conviene saber

- **Rate limit:** por defecto, 120 requests por minuto y por clave. Si lo
  superás: `429` con `RATE_LIMIT_EXCEEDED` y el tiempo a esperar en el mensaje.
- **`Idempotency-Key`:** hasta 255 caracteres.
- **`metadata`:** hasta 4000 caracteres en total.
- **`variables`:** los números se guardan como texto.
- **Plantillas:** solo plantillas **aprobadas** por Meta. La aprobación puede
  tardar: creá la plantilla con tiempo y usá el endpoint
  `notification.failed` (o el `failureCode`) para enterarte.
- **`sendAt`:** es la hora de **salida**. Si mandás una hora pasada, la
  notificación sale en el próximo ciclo de cola.
- **Zona horaria:** mandá `sendAt` con offset (`-03:00`) o en UTC con `Z`.
  Sin offset, la API lo rechaza.
- **Cancelar** solo funciona mientras la notificación está `scheduled`.
- **Los estados en sandbox son simulados**: un `delivered` de una clave test
  no significa que alguien recibió el mensaje.

---

## 13. Referencia rápida

| Método | Ruta                                       | Para qué                                    | Permiso               |
| ------ | ------------------------------------------ | ------------------------------------------- | --------------------- |
| POST   | `/api/v1/notifications`                    | Crear (o programar) una notificación.       | `notifications:write` |
| GET    | `/api/v1/notifications`                    | Listar con filtros.                         | `notifications:read`  |
| GET    | `/api/v1/notifications/:id`                | Estado y timeline.                          | `notifications:read`  |
| POST   | `/api/v1/notifications/:id/cancel`         | Cancelar una notificación programada.       | `notifications:write` |

Referencia completa e interactiva de la API: `/api/docs` (Swagger) en tu
instalación.
