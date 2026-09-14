import { spawn } from 'node:child_process';
import { quartoBinary } from './quarto.mjs';
import { ROOT, SOURCE } from './paths.mjs';
import { checkSource } from './check.mjs';
import { bundleProject } from './bundle-project.mjs';

await bundleProject();
await checkSource();
const child = spawn(quartoBinary(), ['preview', SOURCE, '--host', '127.0.0.1', '--port', '1430', '--no-browser'], { cwd: ROOT, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
