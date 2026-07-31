import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Un token inyectado pero no provisto solo explota al arrancar Nest: `nest
// build` compila igual y los tests no levantan la app. Este chequeo estático
// falla en CI antes de que la API quede caída — pasó con 'FlowHttpPort', cuyo
// HttpModule existía pero nadie importaba.
//
// Se lee el código fuente en vez de importar los módulos porque el
// moduleNameMapper de jest (strip de .js) rompe al resolver zod/mongoose.

// jest corre desde la raíz del paquete api/ (ts-jest compila a CJS: sin import.meta).
const SRC = join(process.cwd(), 'src');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Tokens string declarados como `provide: 'X'` */
function providedTokens(source: string): string[] {
  return [...source.matchAll(/provide:\s*'([^']+)'/g)].map((m) => m[1]);
}

/** Tokens string listados dentro de cada `inject: [ ... ]` */
function injectedTokens(source: string): string[] {
  const tokens: string[] = [];
  for (const match of source.matchAll(/inject:\s*\[([^\]]*)\]/g)) {
    for (const token of match[1].matchAll(/'([^']+)'/g)) tokens.push(token[1]);
  }
  return tokens;
}

function moduleFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...moduleFiles(full));
    else if (entry.name.endsWith('.module.ts')) found.push(full);
  }
  return found;
}

describe('grafo de dependencias de PresentationModule', () => {
  const presentationSource = read(join(SRC, 'presentation', 'presentation.module.ts'));

  it('provee todos los tokens string que inyectan sus providers', () => {
    const provided = new Set(providedTokens(presentationSource));

    // InfrastructureModule reexporta todos los módulos de infraestructura, así
    // que sus tokens quedan visibles para PresentationModule.
    const infraModuleNames = new Set(
      (presentationSource.includes('InfrastructureModule')
        ? [...read(join(SRC, 'infrastructure', 'infrastructure.module.ts')).matchAll(/imports:\s*\[([^\]]*)\]/g)]
        : []
      ).flatMap((match) => match[1].split(',').map((name) => name.trim()).filter(Boolean)),
    );

    for (const file of moduleFiles(join(SRC, 'infrastructure'))) {
      const source = read(file);
      const className = source.match(/export class (\w+Module)/)?.[1];
      if (!className || !infraModuleNames.has(className)) continue;
      for (const token of providedTokens(source)) provided.add(token);
    }

    const missing = [...new Set(injectedTokens(presentationSource))].filter((token) => !provided.has(token));
    expect(missing.sort()).toEqual([]);
  });

  it('registra los controllers de flujos', () => {
    const controllers = presentationSource.match(/controllers:\s*\[([^\]]*)\]/)?.[1] ?? '';
    for (const name of ['FlowController', 'FlowExecutionController', 'FlowConnectionController', 'FlowWebhookController']) {
      expect(controllers).toContain(name);
    }
  });

  it('registra el processor de jobs de flujos', () => {
    expect(presentationSource).toContain('FlowJobProcessor');
  });
});
