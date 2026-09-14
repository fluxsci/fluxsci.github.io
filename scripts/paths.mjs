import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SOURCE = path.join(ROOT, 'site');
export const OUTPUT = path.join(ROOT, 'dist');
export const QUARTO_VERSION = '1.10.18';

export function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
