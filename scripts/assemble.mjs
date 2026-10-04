import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
let html = await readFile(new URL('src/shell.html', root), 'utf8');
for (const [token, file] of [['STYLES','styles.css'],['CORE','core.js'],['CONTENT','content.js'],['EXPORT','export.js'],['UI','ui.js']]) {
  const source = await readFile(new URL('src/' + file, root), 'utf8');
  if (file.endsWith('.js') && /<\/script/i.test(source)) throw new Error(file + ' contains an unsafe script terminator');
  html = html.replace('/* PROOF_' + token + ' */', () => source);
}
if (/\/\* PROOF_/.test(html)) throw new Error('Unfilled application source');
await writeFile(new URL('index.html', root), html);
console.log('Assembled the self-contained offline application.');
