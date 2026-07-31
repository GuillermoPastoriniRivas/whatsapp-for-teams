# Flujos — Motor de automatización por nodos (diseño v1)

Automatizaciones visuales estilo n8n/Make, 100% WhatsApp-first, abiertas a CRMs/pagos/integraciones
vía HTTP + webhooks + conexiones. Reemplaza al "bot IA como única primera línea": el bot pasa a ser
un nodo más dentro de un flujo. Backward compatible: sin flujos publicados, el pipeline actual no cambia.

Este documento es la síntesis final de un proceso de diseño con 3 propuestas independientes + panel
de jueces (2026-07-30). Es la referencia de implementación.

---

## 1. Decisiones estructurales

| Tema | Decisión |
|---|---|
| Lock por conversación | Índice único **parcial** en `flow_executions {conversationId}` con `partialFilterExpression: { status: { $in: ['running','waiting'] } }`. Máx. 1 ejecución viva por conversación, garantizado por Mongo. E11000 al crear ⇒ releer la ganadora y rutear el mensaje como resume/supresión — **nunca** caer al pipeline legado. |
| Esperas sin cancel() de jobs | `resumeToken` (fencing token) rotado en **cada** transición/claim. Todo camino de despertar (reply, timeout, sweep, continuación) debe ganar un CAS `findOneAndUpdate({_id, status, resumeToken})`. Jobs viejos llevan token muerto ⇒ no-op. No se extiende JobQueuePort. |
| Idempotencia vs retry 3× de Agenda | Jobs de flujo con `maxRetries: 1`. Cursor persistido tras cada nodo (escrituras guardadas por token). Envíos WhatsApp **at-most-once**: preferimos flujo fallado visible a mensaje duplicado. Solo el nodo HTTP reintenta (interno, opt-in). |
| Crash / jobs perdidos | Job `flow.sweep` cada 5 min: (a) `running` con `runningSince < now−10min` ⇒ `failed` + fallback `autoAssign(excludeAi)`; (b) `waiting` con `timeoutAt < now−10min` (wake perdido) ⇒ sintetiza el timeout con el token vigente. |
| Versionado | `Flow.draftGraph` mutable + colección `flow_versions` **inmutable**. Publicar = validar → insertar versión → repuntar `publishedVersionId`. Las ejecuciones fijan `flowVersionId` y terminan sobre su versión. Pausar = no matchean triggers nuevos; las vivas siguen. |
| Hook de triggers | `HandleInboundMessageUseCase`, nuevo paso 5c (después de atribución de campaña, antes de auto-assign). Si el router marca `handled` ⇒ se suprimen auto-assign (paso 6) y enqueue de IA (paso 8); pasos 6b/7/9 corren igual. Sin match ⇒ ruta legada byte a byte. |
| Intervención humana | **Siempre gana el humano.** Texto libre de un agente (`SendMessageUseCase`) o asignación manual cancelan la ejecución activa vía un único camino: `CancelActiveFlowExecutionUseCase` (CAS ⇒ `cancelled`, endReason `agent_takeover`, evento FLOW_STOPPED). El composer del inbox avisa antes: "Este chat está en un flujo. Si escribís, el flujo se detiene y seguís vos." |
| Nodos IA | Referencian un agente IA existente por `agentId` (límites diarios y usage cuelgan de `AiAgentConfig`). `ai_reply` (un turno, sin tools) y `ai_route` (clasificador) usan helpers extraídos de `ProcessAiResponseUseCase` a `ai-run.helpers.ts` (refactor sin cambio de comportamiento). `handoff_ai` (terminal) asigna al bot y deja actuar el motor actual intacto. |
| Interactivos | Lockstep completo (enum+entity+schema+mapper+types+parser+DTO+port+adapters Meta/Kapso). Ids de botón `fl:<nodeId>:<idx>`. Matching de respuesta: tap (`interactiveReplyId`) → texto normalizado contra títulos → ordinal ("1","2") → `other`. Twilio degrada a menú numerado (mismo matcher); plantillas en Twilio = error de publicación. Capacidades en `provider-capabilities.ts`. |
| Ciclos | Permitidos con validación de publicación: **todo ciclo debe contener un nodo de espera** (buttons/list/ask/delay). Chequeo: remover nodos de espera del grafo ⇒ el resto debe ser acíclico. Runtime: `stepCount ≤ 200`; presupuesto 20 nodos por corrida de job y continuación re-encolada (con rotación de token). Guard anti-tormenta: máx 10 ejecuciones/hora por conversación. |
| Ventana 24 h | Nodos de sesión chequean `lastInboundAt` (mismo cálculo de `SendMessageUseCase`) con `windowPolicy: 'error'|'skip'`. `send_template` exento (reabre la ventana). Al fallar el flujo la conversación cae a `autoAssign(excludeAi)` — nadie queda colgado. Lint de publicación: envío de sesión alcanzable tras delay ≥ 24 h ⇒ warning; trigger webhook + primer envío de sesión ⇒ warning (sugiere plantilla). |
| Secretos | Nunca en el grafo. Entidad `FlowConnection` {name, headerName, secretEncrypted} AES-256-GCM (env `FLOW_SECRETS_KEY`); API write-only (nunca devuelve el secreto); DELETE ⇒ 409 si una versión publicada la referencia. |
| Pagos v1 | Sin conector con nombre: receta de galería "Cobrar con MercadoPago" = nodo HTTP a `/checkout/preferences` con Connection + `send_text` con `{{vars.pago.body.init_point}}`. Conectores futuros = azúcar sobre HTTP+Connection. |
| Prioridad de triggers | Campo explícito `priority` (drag en la lista escribe 10, 20, 30…). Primer match gana. |
| Idioma UI | Híbrido: el chrome del área (nav, lista, publicar, estados, inbox) va por i18n `translations.ts` (`t.flows.*`, es+en). El copy profundo del dominio (nombres/labels/forms de los 18 tipos de nodo) vive es-first en `ui/src/lib/flows/node-catalog.ts`, igual que el precedente del área de agentes IA — deuda declarada para cuando el producto salga de LATAM. |
| Canvas | `@xyflow/react` v12 (nueva dep). Neutralización del zoom global: `.zoom-neutral { zoom: calc(1 / var(--content-zoom, 1.15)) }` en el mismo media query ≥768px. Componentes del canvas con `"use no memo"` preventivo (React Compiler ON). |
| Plan gating | Publicar exige plan con recurso `flows` (Pro vende "automatizaciones"); crear borradores es libre (funnel de upgrade). |

## 2. Taxonomía de nodos v1 (18 tipos)

Un flujo tiene exactamente **un** trigger. Nodo = `{ id, type, position, data }` (shape nativo xyflow).
Edges = `{ id, source, sourceHandle, target }`. Handle sin edge ⇒ la ejecución termina `completed`
(salvo `error` sin conectar ⇒ `failed`).

### Triggers
- **`trigger.inbound_message`** — phoneNumberIds[] (vacío = todas), match any|keywords (keywords ≤20,
  modo exact|contains, normaliza tildes/mayúsculas), onlyNewConversations, ignoreIfAssignedToHuman
  (default true). Handle: `out`.
- **`trigger.webhook`** — phoneNumberId (línea saliente), contactPhoneField (dot-path, default `phone`),
  contactNameField?. URL `POST /api/hooks/flows/:flowId/:token` (token 32 bytes, timingSafeEqual, 404 si
  no matchea). Payload JSON ≤64KB ⇒ `{{webhook.*}}`. 202 {executionId} | 409 conversation_busy. Handle: `out`.

### Mensajes
- **`action.send_text`** — body (≤4096, con variables), windowPolicy. Handles: `out`, `error`.
- **`action.send_buttons`** ⭐ — body, footer?, buttons 1–3 {title ≤20}, timeout {amount,unit} (máx 7d),
  saveAs?, windowPolicy. Handles: `btn:<idx>` por botón, `other`, `timeout`, `error`. Si `other` no está
  conectado y llega texto no matcheado ⇒ re-prompt (invalidMessage config, máx 2, contador en waitState,
  token rotado, mismo timeoutAt) y después rama `timeout`.
- **`action.send_list`** — body, footer?, buttonText ≤20, rows 1–10 {title ≤24, description? ≤72},
  ídem buttons. Handles: `row:<idx>`, `other`, `timeout`, `error`.
- **`action.send_template`** — templateId (APPROVED, misma línea), variables {source: contact_field|
  flow_var|static, value} (shape de CampaignVariableMapping; reusa buildTemplatePayload). Único nodo
  que reabre la ventana. Handles: `out`, `error`.
- **`action.ask`** — body, saveAs (obligatorio), validation texto|numero|email|telefono + invalidMessage
  (re-prompt máx 2), saveToContact? name|email|company|custom.<key>, timeout. Handles: `reply`,
  `invalid` (opcional), `timeout`, `error`.

### IA
- **`action.ai_reply`** — aiAgentId, instructions? (se agrega al system prompt). Un turno sin tools,
  bubbles según multiMessage del agente, usage/rate-limit contra el agente. Handles: `out`, `handoff`
  (pre-check de handoff disparó), `error`.
- **`logic.ai_route`** — aiAgentId, question?, options 2–6 {key,label}. Prompt "respondé solo una key",
  parseo defensivo (exacto → inclusión → fallback). Handles: `opt:<key>`, `fallback` (conexión obligatoria).
- **`action.handoff_ai`** *(terminal)* — aiAgentId. Asigna la conversación al bot (+activeCount, evento
  ASSIGNED), encola `ai.process-response`, termina `completed` (endReason delegated_ai).

### Equipo / CRM
- **`action.handoff_human`** *(terminal)* — note? (con variables). Mecánica de HandoffToHumanUseCase
  (nota + evento + autoAssign excludeAi). endReason handoff.
- **`action.assign_agent`** — mode specific|auto, agentId?. Handles: `out`, `unassigned`.
- **`action.label`** — action add|remove, labelId. Handle: `out`.
- **`action.update_contact`** — fields [{field: name|email|company|notes|custom.<key>, value}] (notes
  = append). Handle: `out`.
- **`action.internal_note`** — body con variables. Handle: `out`.

### Lógica
- **`logic.condition`** — logic and|or, rules [{source, op, value?}]. Sources: variable/dot-path
  (contact.*, vars.*, message.*, webhook.*) **y** hora/día (franja horaria + días + timezone IANA).
  Ops: equals|not_equals|contains|not_contains|starts_with|gt|lt|exists|not_exists|in_schedule.
  Handles: `yes`, `no`.
- **`logic.delay`** — duration {amount, unit: minutes|hours|days} (1 min–7 días). Handle: `out`.
  Mensajes entrantes durante un delay NO responden preguntas posteriores (documentado).

### Integraciones
- **`action.http`** — method, url (https, con variables), headers [{name,value}], connectionId?
  (inyecta header secreto server-side), bodyMode none|json, body?, saveAs? (guarda {status, body}),
  retryOnFailure (default false; 2 reintentos internos 2s/4s), timeout 10s fijo, respuesta cap 256KB,
  SSRF guard (resolver DNS, bloquear loopback/RFC1918/link-local/169.254), redirects máx 3 re-chequeados.
  Handles: `success`, `error` (recibe igual vars.<saveAs> = {status, body}).

## 3. Modelo de datos

Colecciones nuevas: `flows`, `flow_versions`, `flow_executions`, `flow_node_stats`, `flow_connections`.
Receta estándar del repo (entidad readonly → repo interface → schema @Prop type Object → mapper → repo
Mongo → tokens string en persistence.module).

### Flow
`{ id, tenantId, name, description|null, status: draft|published|paused|archived, draftGraph,
publishedVersionId|null, publishedVersion|null, priority, webhookToken|null, stats {started,
completed, failed, cancelled}, createdByAgentId, createdAt, updatedAt }`
Índices: `{tenantId, status, priority}`, `{tenantId, updatedAt: -1}`.

### FlowVersion (inmutable)
`{ id, flowId, tenantId, version, graph, trigger (denormalizado: {type, phoneNumberIds, match,
keywords, keywordMode, onlyNewConversations, ignoreIfAssignedToHuman, contactPhoneField…}),
publishedByAgentId, createdAt }`
Índices: `{flowId, version: -1}` unique.

### FlowExecution
`{ id, tenantId, flowId, flowVersionId, conversationId, contactId, phoneNumberId,
status: running|waiting|completed|failed|cancelled, currentNodeId|null, resumeToken,
stepCount, waitState {nodeId, kind: reply|delay, timeoutAt, waitingSince, saveAs|null,
optionMap|null, attempts, validation|null}|null, variables {}, steps [{nodeId, type, status,
handle|null, at, ms, note?}] (cap 200), triggeredBy {type, messageId?}, endReason|null,
error {nodeId, message}|null, runningSince|null, startedAt, endedAt|null, createdAt, updatedAt }`
Índices: parcial único `{conversationId}` (running|waiting), `{tenantId, flowId, startedAt: -1}`,
`{status, runningSince}`, `{status, 'waitState.timeoutAt'}`, `{conversationId, startedAt: -1}`.

**Protocolo de token (invariante central):** `resumeToken` se rota en cada claim/transición.
- Crear: token T0 + enqueue `flow.execute {executionId, token: T0}`.
- `flow.execute`: claim CAS `{_id, status:'running', resumeToken: token}` ⇒ `{resumeToken: fresh,
  runningSince: now}`; null ⇒ salir. El worker guarda `fresh` y **toda** escritura posterior
  (cursor, wait, fin) va guardada por `{_id, status:'running', resumeToken: fresh}`.
- Entrar a espera: CAS ⇒ `{status:'waiting', waitState{...}, resumeToken: W}` + schedule
  `flow.resume {executionId, token: W, reason:'timeout'}` en timeoutAt (SIEMPRE; nunca se cancela).
- Reply: router encola `flow.resume {executionId, token: W-leído, reason:'reply', messageId,
  interactiveReplyId?, body?}`. Resume: CAS `{_id, status:'waiting', resumeToken: token}` ⇒
  `{status:'running', waitState:null, resumeToken: fresh}`; null ⇒ no-op.
- Recheck post-persist: tras persistir `waiting`, releer `conversation.lastInboundAt`; si entró un
  inbound después del instante del envío del nodo ⇒ buscar ese mensaje y encolar el resume con W.
  Duplicados inofensivos por el CAS.
- Continuación (presupuesto agotado): rotar token vía CAS y encolar `flow.execute` con el nuevo.

### FlowNodeStat
`{ id, tenantId, flowId, flowVersionId, nodeId, date 'YYYY-MM-DD', entered, errors,
outcomes: Record<handle, count> }` — upsert `$inc` atómico. Índice unique
`{flowVersionId, nodeId, date}`. Alimenta el overlay de funnel ("68% tocó Ver catálogo").

### FlowConnection
`{ id, tenantId, name, headerName, secretEncrypted, createdAt, updatedAt }` — AES-256-GCM.

### Cambios a entidades existentes (lockstep, aditivo, sin migración)
- `MessageType` += `INTERACTIVE = 'interactive'`.
- `Message` (+schema+mapper+UpsertMessageInput): `interactiveReplyId|null`, `contextWaMessageId|null`,
  `interactivePayload|null` (outbound: JSON de botones/lista para render en el chat).
- `meta-webhook.types.ts`: tipar `interactive {type, button_reply?, list_reply?}`, `button {payload,
  text}`, `context {id}`.
- `meta-webhook.parser.ts`: SUPPORTED_TYPES += interactive, button; extractBody devuelve el título
  elegido; emite interactiveReplyId (button_reply.id | list_reply.id | button.payload) y
  contextWaMessageId (context.id).
- `InboundMessageInput` += interactiveReplyId?, contextWaMessageId?.
- `SendMessageParams` += `interactive?: { kind:'buttons'|'list', body, footer?, buttons?, buttonText?,
  rows? }`; branch `interactive` en Meta y Kapso (payload `{type:'interactive', interactive:{type:
  'button'|'list', body:{text}, footer?, action:{buttons|sections}}}`).
- `provider-capabilities.ts` (nuevo): `{meta:{interactive:true,templates:true}, kapso:{...true},
  twilio:{false,false}, demo:{true,true}, '360dialog':{false,false}}`.
- `ConversationEventType` += FLOW_STARTED, FLOW_COMPLETED, FLOW_FAILED, FLOW_STOPPED.
- Errores: FlowNotFoundError, FlowInvalidGraphError, FlowExecutionNotFoundError,
  FlowConnectionNotFoundError, FlowConnectionInUseError.

## 4. Router de entrada (paso 5c)

```
FlowInboundRouterUseCase.route(ctx) → { handled: boolean }
  A) ejecución viva waiting(reply) ⇒ enqueue flow.resume(token leído, messageId,
     interactiveReplyId, body) ⇒ handled
  B) ejecución viva running | waiting(delay) ⇒ handled (el flujo es dueño; el mensaje
     queda en historial)
  C) sin ejecución viva ⇒ matchear triggers de versiones publicadas (flows published,
     orden priority asc; guard anti-tormenta 10/h) ⇒ crear ejecución (tryCreateActive;
     E11000 ⇒ releer y tratar como A/B) + evento FLOW_STARTED + enqueue flow.execute ⇒ handled
  D) sin match ⇒ handled = false
```
`handled` ⇒ HandleInboundMessage saltea auto-assign (6) y enqueueAiResponse (8). 6b/7/9 corren igual.

## 5. Jobs

`FlowJobProcessor` (patrón AiResponseJobProcessor):
- `flow.execute` {executionId, token} — concurrencia 5, maxRetries 1 → ExecuteFlowStepUseCase.
- `flow.resume` {executionId, token, reason, messageId?, interactiveReplyId?, body?} — 5, 1 →
  ResumeFlowExecutionUseCase.
- `flow.sweep` {} — auto-reprogramado cada 5 min (patrón campaign.dispatch), concurrencia 1 →
  SweepFlowExecutionsUseCase.

## 6. Variables

Sintaxis `{{path}}` (regex simple, sin filtros). Path inexistente ⇒ "" + note en step log.
Namespaces: `contact.*` (fresco), `message.body|type` (snapshot trigger), `vars.<saveAs>`
(capturas; HTTP: `vars.x.status`, `vars.x.body.<path>`), `webhook.<path>` (snapshot), `flow.name`.
Variables cap 32KB. Resolver puro `flow-variable.resolver.ts` + `renderTemplate`.

## 7. Validación de publicación (`flow-graph.validator.ts`)

Estructural (Zod en DTO) + semántica en publish:
- Exactamente 1 trigger; todos los nodos alcanzables desde el trigger; edges válidas
  (source/target/handle existentes; 1 edge por sourceHandle).
- Config por tipo (unión discriminada Zod): límites WhatsApp (3 botones/20 chars, 10 filas/24-72),
  ai_route.fallback conectado, ask.saveAs presente, etc.
- Ciclos: remover nodos de espera ⇒ resto acíclico, si no ⇒ error "Este ciclo no tiene ninguna espera".
- Capacidades: interactivos/plantillas sobre línea Twilio ⇒ error (plantillas) / warning + degradación
  (botones/listas).
- Ventana: sesión tras delay ≥ 24 h ⇒ warning; webhook trigger con primer envío de sesión ⇒ warning.
- Referencias: templateId APPROVED misma línea, labelId/agentId/aiAgentId/connectionId existentes.
- saveAs duplicados en ramas paralelas ⇒ warning.

## 8. API REST

```
GET/POST           /flows                       (POST: PlanLimitGuard no; publicar sí)
GET/PATCH/DELETE   /flows/:id                   (PATCH: name?, description?, draftGraph?, priority?)
POST               /flows/:id/publish           → 422 {errors[]} | 200 {versionId, version, warnings[]}
POST               /flows/:id/pause | /activate
POST               /flows/:id/webhook-token     → regenera
GET                /flows/templates             → galería estática
GET                /flows/:id/versions          → historial (metadata)
GET                /flows/:id/versions/:versionId → una versión con su grafo (previsualizar/restaurar)
GET                /flows/:id/executions?page&status
GET                /flows/:id/stats?days=30     → flow_node_stats agregado
GET                /flow-executions/:id         → steps + variables
POST               /flow-executions/:id/cancel
GET/POST/DELETE    /flow-connections            (secret write-only; DELETE 409 si en uso)
POST               /hooks/flows/:flowId/:token  @Public
GET /conversations/:id → += activeFlow {flowId, flowName, executionId, status}|null
```

## 9. UI

- Sidebar "Flujos" (icono Workflow, admin, topTabs) + mobile MORE_ROUTES; i18n `t.nav.flows` +
  namespace `t.flows.*` es/en.
- `/flows`: lista (nombre, estado pill, versión, ejecuciones 7d, prioridad drag) + galería de
  plantillas (Menú de bienvenida / Fuera de horario / Calificar leads / Cobrar con MercadoPago).
- `/flows/[id]`: builder full-height. Paleta izquierda por categorías; canvas @xyflow (nodos custom
  por familia: triggers naranja --accent, mensajes teal --primary, IA violeta, lógica neutral;
  edges con label del handle); panel derecho de config por tipo con: contador de chars, botón {x}
  variable picker (recorre el grafo aguas arriba), **preview de burbuja WhatsApp en vivo**
  (--asis-bubble-outbound, con botones dibujados). Autosave draft debounce 1.5s + "Guardado ✓".
  Publicar ⇒ dialog con copy de versionado ("las conversaciones en curso terminan con la versión
  anterior"); 422 pinta nodos con borde rojo + sheet de errores clickeables. Tabs Editor |
  Ejecuciones (tabla + drawer con steps/variables) | overlay de stats en canvas.
- Wrapper `.zoom-neutral` + `"use no memo"` en componentes del canvas.
- Inbox: chip "⚡ {flowName}" + "Detener flujo"; aviso en composer cuando hay flujo activo; eventos
  FLOW_* en el timeline; burbujas interactivas outbound renderizan sus botones (interactivePayload);
  reply inbound muestra el título elegido.
- Builder en mobile: solo lectura.

## 10. Orden de implementación

- **Etapa A** — Interactivos end-to-end (12 archivos, valor propio, deploy seguro independiente). ✅
- **Etapa B** — Dominio + persistencia de flujos (enums, entidades, repos, schemas, mappers,
  crypto service, persistence.module). ✅
- **Etapa C** — Motor (ai-run.helpers + refactor, validator, resolver, executors + engine,
  execute/resume/sweep/router/webhook-start, CRUD use cases, FlowJobProcessor, hook en
  handle-inbound + cancel en send-message/assign). ✅
- **Etapa D** — API (DTOs Zod, controllers, presentation.module, plan limits). ✅
- **Etapa E** — UI (dep @xyflow/react, zoom-neutral, tipos, store, páginas, canvas, paleta,
  config panels con preview de burbuja, variables, publish con errores 422, ejecuciones,
  galería, conexiones, sidebar/nav, i18n, inbox: chip + composer + eventos + burbujas
  interactivas). ✅
- **Etapa F** — Review adversarial multi-agente + fixes + build + tests. ✅

## 11. Estado y pendientes pre-GA

Implementado completo (backend + UI), typecheck y builds verdes, 49 tests de API en verde
(specs de resolver/matcher/validador del motor + chequeo estático del grafo de DI).

### Correcciones de la review adversarial

| Hallazgo | Fix |
|---|---|
| **`HttpModule` nunca importado** ⇒ `FlowHttpPort` sin resolver: la API no arrancaba (el `nest build` no valida DI) | Importado/exportado en `InfrastructureModule` + `presentation/di-graph.spec.ts`, chequeo estático que falla en CI ante cualquier token inyectado y no provisto |
| Un envío humano fallido (ventana vencida, error del proveedor) cancelaba igual el flujo | `cancelActiveFlow` movido **después** del envío exitoso en `SendMessageUseCase` |
| Un job `ai.process-response` ya encolado podía responder en paralelo al flujo | `ProcessAiResponseUseCase` corta si hay ejecución viva en la conversación |
| Plantilla sobre línea Twilio: publicaba y enviaba un mensaje **vacío** | Lint de capacidades en publicación (error) + guard en el motor; botones/listas solo avisan (degradan a menú numerado) |
| Plantilla de otra línea ⇒ rechazo de Meta en runtime | Validado en publicación y en `execSendTemplate` |
| Reentrega del webhook re-ruteaba un mensaje ya consumido y contestaba la pregunta siguiente | `FlowExecution.lastConsumedMessageId`: el resume por respuesta descarta el mensaje ya usado |
| Límite de plan evadible pausando/publicando/reactivando | `ActivateFlowUseCase` valida el límite |
| `pendingAiSince` quedaba latcheado al tomar el flujo la conversación | Se limpia cuando el router consume el mensaje |
| Dos títulos que normalizan igual ("Sí"/"SI") colapsaban el mapa y desviaban la rama | Primer título gana; `optionMap` siempre poblado para fijar el orden de los ordinales |
| Footer >60 chars ⇒ 400 de Meta en runtime | Acotado al enviar |

### Segunda pasada (review con Opus 5: 29 confirmados, 5 refutados)

| Hallazgo | Fix |
|---|---|
| **SSRF explotable por DNS rebinding**: se validaba el DNS y `fetch` resolvía de nuevo (TOCTOU) ⇒ acceso a metadata de la nube / red interna | Cliente reescrito sobre `node:http/https` con `lookup` propio: la IP se valida **dentro** de la resolución que abre el socket. IPs literales validadas aparte (Node no llama a `lookup` con ellas) + 7 tests |
| El secreto de la Conexión viajaba a cualquier host de un `Location` | Headers del caller descartados al cambiar de origen; se rechaza el downgrade https→http |
| **Borrar un botón del medio** re-apuntaba las ramas restantes a nodos equivocados, en silencio | `computeHandleRemap`: las conexiones se remapean antes de filtrar |
| **Editar la clave de una opción de IA** borraba su rama en cada tecla | Ídem: remapeo posicional de `opt:<key>` |
| Supr borraba el disparador y el flujo quedaba inservible (la paleta no ofrece triggers) | `deletable: false` en los nodos trigger |
| Publicar mandaba el borrador anterior (debounce de 1,5 s sin volcar) | `flushSave()` antes de publicar; aborta si el guardado falla |
| Edición perdida al salir del builder y errores de guardado silenciosos | Volcado en el unmount + indicador "Sin guardar" con el error |
| Una respuesta llegada mientras se enviaba la re-pregunta quedaba huérfana hasta el timeout | `reprompt` usa el mismo recheck anti-carrera que `enterWait` (helper compartido) |
| El recheck comparaba el timestamp de Meta (truncado a segundos) contra el reloj del servidor ⇒ perdía justo las carreras sub-segundo | Se compara solo contra `conversation.lastInboundAt` (mismo reloj, ms) |
| "Entregar al bot" encolaba el job **antes** de cerrar la ejecución (el guard nuevo lo descartaba) y sin latch de debounce | El job se encola en `afterFinish`, ya cerrada; se setea `pendingAiSince` |
| Un reintento del job entrante relanzaba el flujo entero (mensajes duplicados al cliente) | Índice único parcial sobre `triggeredBy.messageId` + `lastConsumedMessageId` sembrado con el mensaje disparador |
| La IA podía responder igual si el flujo tomaba la conversación durante la llamada al LLM | Revalidación justo antes de escribirle al cliente |
| `ai_route` sin la rama "No se pudo clasificar" conectada cortaba la ejecución sin respuesta | Validado en publicación |
| `template_wrong_phone` nunca podía fallar con el disparador en "todas las líneas" (el default) | Exige que **todas** las líneas destino sean la de la plantilla |
| El monto del template de MercadoPago se interpolaba sin comillas ⇒ body roto o inyección | `renderJsonTemplate` distingue posición de string vs valor; los números se guardan como número (`parseLatamNumber`) |
| Id malformado en el webhook público ⇒ 500 con stack en vez de 404 | `ObjectId.isValid` en el repositorio |
| Conexión borrable aunque la usara un flujo pausado (se reactiva sin revalidar) | El chequeo de uso incluye los pausados |
| Cancelar era admin-only pero el botón del inbox se muestra a todos | `@Roles('admin','agent')` en el handler + manejo del error en la UI |
| Contador de caracteres 4096 en botones (el límite real es 1024); bots inactivos ofrecidos en el picker | Corregidos en el panel de config |

### Historial de versiones en el builder

El pill de estado (`Activo · v2`) y el badge de "cambios sin publicar" abren un panel con el
historial. Desde ahí se puede **restaurar** cualquier versión (trae su grafo al borrador; no
publica hasta que se toque Publicar) y **descartar** los cambios sin publicar (devuelve el
borrador a la versión en uso). Publicar sigue creando la versión siguiente. El badge se
recalcula comparando el borrador contra el grafo de la versión publicada.

### Layout del builder

`<main>` del layout autenticado es `flex-1 overflow-hidden` y mide menos que el viewport, así que
el builder usaba `h-screen` y se recortaba por abajo sin llegar a scrollear. Ahora usa `h-full` y
las columnas (paleta y panel de config) llevan `h-full min-h-0` para que su `overflow-y` funcione.

Pendientes conocidos:
- **Smoke test Kapso**: verificar en staging que el proxy reenvía los webhooks `interactive`
  verbatim (si no: los números Kapso degradan a menú numerado vía capability flag).
- **Spike React Compiler × xyflow**: los componentes del canvas llevan `"use no memo"`
  preventivo; validar drag/connect/zoom en el navegador.
- **env**: `FLOW_SECRETS_KEY` requerida para usar Conexiones (la app bootea sin ella).
- Fase siguiente (v1.1): conector MercadoPago con nombre (azúcar sobre HTTP+Connection),
  trigger por respuesta de campaña, HMAC opcional en el webhook entrante, media en nodos.
