import { cp, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nodesDir = join(packageRoot, 'nodes');
const distNodesDir = join(packageRoot, 'dist', 'nodes');

const nodeFolders = await readdir(nodesDir, { withFileTypes: true });

for (const folder of nodeFolders) {
  if (!folder.isDirectory()) continue;
  const files = await readdir(join(nodesDir, folder.name));
  for (const file of files.filter((name) => name.endsWith('.svg') || name.endsWith('.png'))) {
    await cp(join(nodesDir, folder.name, file), join(distNodesDir, folder.name, file));
  }
}
