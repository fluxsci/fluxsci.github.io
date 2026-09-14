import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { QUARTO_VERSION } from './paths.mjs';

export function quartoBinary() {
  const candidates = process.env.QUARTO_BIN
    ? [process.env.QUARTO_BIN]
    : ['quarto', path.join(homedir(), '.local', 'bin', 'quarto')];
  for (const binary of candidates) {
    const result = spawnSync(binary, ['--version'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') continue;
    if (result.status !== 0) throw new Error(`Cannot run Quarto: ${binary}`);
    const version = result.stdout.trim();
    if (version !== QUARTO_VERSION) {
      throw new Error(`Quarto ${QUARTO_VERSION} is required; ${binary} is ${version}. Set QUARTO_BIN to the pinned executable.`);
    }
    return binary;
  }
  throw new Error(`Install Quarto ${QUARTO_VERSION} from https://quarto.org/docs/download/ or set QUARTO_BIN.`);
}
