// Builds RedRover for exodus.red/redrover/ and copies it into the website project.
// Usage: npm run build:site   (then `npm run deploy` in ../ExodusRed)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const site = resolve(import.meta.dirname, '../../ExodusRed/public/redrover');
const dist = resolve(import.meta.dirname, '../dist/red-rover/browser');

execSync('npx ng build --base-href /redrover/', { stdio: 'inherit' });
if (!existsSync(dist)) throw new Error(`Build output not found: ${dist}`);
rmSync(site, { recursive: true, force: true });
cpSync(dist, site, { recursive: true });
console.log(`\nCopied game to ${site}`);
