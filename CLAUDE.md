# Repo guille/whatsapp

Monorepo con varios proyectos: `api/` + `ui/` (asis.chat), `mdvault/` (memoria markdown para agentes), `aloe-village/` (demo hotel), `quiero-menu/`, `turnos/`.

## Memoria compartida: leé antes de trabajar

Este repo tiene memoria compartida entre agentes y personas (mdvault, servida por MCP). **No arranques una tarea sin consultarla**: ahí están las decisiones ya tomadas, las convenciones, los gotchas y las specs que dejaron otros agentes y el equipo. Ignorarla es rehacer trabajo, proponer algo ya descartado o pisar un problema conocido.

Ciclo obligatorio:

1. **Al empezar** — llamá a `context` con la tarea que vas a hacer (o `search` si ya sabés el tema). Si arrancó una sesión nueva, el índice ya viene inyectado: usá `read` para lo que te sirva.
2. **Mientras trabajás** — `search` / `read` cuando toques un área nueva.
3. **Al aprender algo que le sirve a otro** — `write`: decisiones, convenciones, gotchas, specs, RFCs, planes. No lo dejes solo en el resumen de la conversación, que se pierde.
4. **Cuando verifiques que un doc viejo sigue vigente** — `confirm`, así no envejece sin que nadie sepa si todavía es cierto.

La memoria la leen humanos desde una web (localhost:3300): escribí para que otro entienda, no para vos.

## Documentos de trabajo → mdvault, no archivos sueltos

Specs, RFCs, planes de implementación, decisiones/ADRs, research y postmortems **no se crean como .md sueltos en el repo**: se escriben en mdvault con `write`, bajo el proyecto correspondiente.

- Nombre: `<proyecto>/<tipo>-<tema>` — ej. `mdvault/spec`, `asis/rfc-embedded-signup`, `aloe-village/plan-backend`.
- `type`: `spec` | `rfc` | `plan` | `decision` | `gotcha` | `milestone` | `note`.
- Linkeá con `[[wikilinks]]` usando el path completo: `[[mdvault/overview]]`.
- Antes de crear, `search` si ya existe un doc que convenga actualizar.

Sí van al repo: README, este CLAUDE.md, y docs que el código o el CI consumen directamente.

## Gotchas del monorepo

- `ui/` (asis.chat): **no correr `npm run build` con el `next dev` levantado** — rompe las rutas dinámicas del dev server (404 silencioso). Para validar: `npx tsc --noEmit`. Leer `ui/DESIGN.md` antes de tocar UI.
- `mdvault/`: los packages se consumen por `dist/` — tras tocar core/platform/mcp: rebuild + **reiniciar** los procesos de 3300 (UI) y 3301 (server). Next no recarga dist de node_modules.

## Cómo está cableada la memoria

- `.mcp.json` define de dónde sale: server MCP remoto (`http://localhost:3301/mcp` + API key del workspace) o vault local (`--root <carpeta>`).
- El hook `SessionStart` de `.claude/settings.json` inyecta el índice al arrancar la sesión, corriendo `mdvault-context --hook`. Ese CLI **lee el origen del propio `.mcp.json`**, así que no hay que duplicar la key ni mantener dos configs.
- Para otros agentes o CI: `node mdvault/packages/mcp/dist/context-cli.js --task "lo que vas a hacer"` imprime el mismo digest en markdown.
