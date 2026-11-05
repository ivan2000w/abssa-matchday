import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash = createHash('sha256');
for (const file of readdirSync('dist', {recursive: true}).sort()) {
  if (/\.(js|css|html|json)$/.test(file) && file !== 'sw.js') hash.update(readFileSync(`dist/${file}`));
}
const sw = readFileSync('dist/sw.js','utf8');
writeFileSync('dist/sw.js', sw.replace('__BUILD_ID__',hash.digest('hex').slice(0,16)));
writeFileSync('dist/.nojekyll','');
