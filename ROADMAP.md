# Roadmap — asis.chat + verticales (jul 2026 → q2 2027)

**Modelo:** un motor (asis) + verticales como funnels de adquisición.
**Regla de oro:** cada fase se desbloquea SOLO cumpliendo el gate de la anterior. El gate se mide en clientes pagos, nunca en features terminados.
**Realidad de tiempo:** esto asume ~15-20 hs/semana además de Kinamic. Si una fase se estira, se estira el calendario — no se abren fases en paralelo para "compensar".

---

## Fase 0 — Fundación comercial (semanas 1-2, en paralelo a templates)

Objetivo: que exista la máquina de vender antes de que exista más producto.

- [ ] **Página de pricing pública en asis.chat.** Dos planes para arrancar: Starter ~USD 29/mes (inbox multiagente + templates) y Pro ~USD 79/mes (+ bots IA + automatizaciones). Trial 14 días. El precio va a estar mal; el objetivo es que exista.
- [ ] **Recuperar el lead de templates.** Mensaje: early access + descuento fundador por ser el primero que lo pidió.
- [ ] **Vidriera:** README de perfil en GitHub, bio, 3 repos pineados con descripción; LinkedIn reposicionado ("WhatsApp API para operaciones de PyMEs en LATAM"). 2 horas, no más.
- [ ] **Consulta con contador** (una sola, concreta): residencia fiscal y entidad AR vs UY. Decisión tomada antes de facturar al primer cliente del exterior.

## Fase 1 — Motor asis: núcleo comercializable (semanas 1-6)

Objetivo: lo mínimo que un cliente paga, con el registro Meta destrabado.

- [X] **Templates (en curso):** CRUD + categorías (marketing/utility/auth), sync de estados de aprobación y calidad con Meta, envío de campañas con segmentación básica, métricas enviado/entregado/leído/respondido, y "continuar en el inbox" desde una respuesta de campaña.
- [ ] **Tech Provider + Embedded Signup v4:** Business Portfolio verificado → registro Tech Provider → App Review (los 2 videos: mensaje enviado desde la app + template creado — sale gratis del punto anterior) → flujo ES v4 con sub-flow de Coexistence → token exchange + webhooks + alta multi-WABA. El cliente paga a Meta con su propia tarjeta: asis nunca queda en el medio de esa factura.
- [ ] **Dashboard de costo por conversación** (imprescindible antes de octubre): contador de mensajes por categoría × rate card por país del destinatario, proyección de factura Meta mensual. Es el feature que convierte el cambio de pricing de Meta en tu argumento de venta.
- [ ] **Billing propio:** dLocal Go (multi-país, métodos locales) + MercadoPago donde tengas entidad. Suscripción, trial, dunning básico.
- [ ] **Diseño del bot orientado a costos:** respuestas consolidadas en 1 mensaje, interactivos (botones/listas/flows) para resolver en menos vueltas.

**GATE 1: App Review aprobado + 1 cliente pago.**

## Fase 2 — Lanzamiento comercial de asis (semanas 6-10)

Objetivo: que el producto se venda sin Guillermo en la llamada.

- [ ] **Onboarding self-serve completo:** signup → Embedded Signup → primer template enviado en <15 minutos. Medir el funnel.
- [ ] **Campaña "octubre":** 4-6 piezas de contenido sobre "WhatsApp te empieza a cobrar cada mensaje: cuánto vas a pagar y cómo bajarlo", con el dashboard de costos como demo. Es la única ventana de timing del año — Meta te regaló el gancho.
- [ ] **Soporte dogfooding:** el soporte de asis se atiende con asis (número de WhatsApp propio, bot + vos). Docs en español desde el día uno.
- [ ] **3 conversaciones por semana** con prospectos/clientes. Métrica personal innegociable.

**GATE 2: 5 clientes pagos de asis (~USD 200-300 MRR).**

## Fase 3 — Vertical 1: Turnos (semanas 10-16)

Objetivo: el primer vertical, con cliente de diseño en casa.

- [ ] **Núcleo diferencial:** calendario multi-recurso con intersección de disponibilidad real (profesional × gabinete × equipo), duración por servicio, reglas de solapamiento. Esto es lo que Calendly/agendas genéricas no resuelven — es EL producto.
- [ ] **Capa asis (por API, cero lógica WhatsApp dentro de Turnos):** confirmaciones y recordatorios (utility templates), reprogramación conversacional por bot, lista de espera automática cuando se libera un hueco.
- [ ] **Killer feature de cobro:** seña por link de MercadoPago/dLocal al confirmar el turno → ataque directo al no-show, que es EL dolor del rubro.
- [ ] **Piloto:** el centro de tu esposa como cliente de diseño + el proyecto de marketing de Tina como canal de aprendizaje de distribución en el nicho.
- [ ] **GTM:** grupos/comunidades de dueñas de centros de estética, referidos del piloto, contenido corto mostrando la intersección de recursos.

**GATE 3: 5 centros de estética pagando (fuera de la familia).**

## Fase 4 — Vertical 2: quiero.menu (semanas 16-22)

Objetivo: el funnel viral, barato de lanzar porque el motor ya existe.

- [ ] **Gratis para siempre:** foto → OCR → página quiero.menu/slug con botón "Pedir por WhatsApp". Aprovechar ventana de 72 hs cuando el tráfico venga de anuncios Click-to-WhatsApp.
- [ ] **Upsell asis:** pedido estructurado al inbox, bot que toma/confirma pedidos, link de cobro. Precio gastronómico propio (más bajo que asis genérico, o fee por pedido).
- [ ] **GTM viral:** Reels/TikTok del onboarding mágico ("60 segundos de la foto a tu página"). Es el mejor demo filmable de todo el portfolio.

**GATE 4: 10 restaurantes activos + primera conversión free→paid orgánica.**

## Fase 5 — Vertical 3: Mantenimiento / field service (mes 6+)

Objetivo: el de mayor potencial (la réplica de Jobber/Housecall Pro para LATAM) — va último porque es el producto más profundo y la venta más activa.

- [ ] Órdenes de trabajo creadas y asignadas desde panel web; el técnico opera 100% desde WhatsApp: recibe la orden, checklist, foto de evidencia, marca completado, manda link de cobro.
- [ ] Nicho de entrada ya identificado en asis: instaladores / mantenimiento hotelero. Empezar por ahí, con 2-3 clientes de diseño.
- [ ] Reusar TODO: calendario de recursos de Turnos (cuadrillas = recursos), mensajería/bots/cobros de asis.

**GATE 5: 3 empresas de servicios pagando.**

---

## Reglas transversales (imprimir y pegar en el monitor)

1. **Los verticales no tienen backend de mensajería, bots ni cobros.** Todo eso vive en asis y se consume por API. Si aparece lógica de WhatsApp dentro de un vertical, algo salió mal.
2. **Un feature entra al roadmap solo si:** lo pidió un cliente con plata, o lo exige Meta. No hay tercera puerta.
3. **Nada se lanza sin precio publicado.** Nunca más "no tengo un precio".
4. **Ideas nuevas** (incluida cualquier quinta vertical) van a una lista de parking, se revisan al cumplir el gate vigente. No antes.
5. **Ritmo comercial fijo:** 3 conversaciones con clientes/prospectos por semana, en cualquier fase, sin excepción.
6. **Canal-agnóstico por diseño:** los verticales deben poder sumar Instagram DM / webchat mañana sin reescritura. Es tu seguro contra Meta.

## Hitos de calendario clave

- **15 oct 2026:** deprecación de Embedded Signup v2 (vos ya arrancás en v4 — verificar igual).
- **1 oct 2026:** service messages pagos → lanzamiento de la campaña de contenido + dashboard de costos YA vivo.
- **Rate cards de Meta:** revisar cada 1 ene / 1 abr / 1 jul / 1 oct.