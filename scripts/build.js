import { readFile, mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../',import.meta.url));
const dist = path.join(root,'dist');
await mkdir(path.join(dist,'assets'),{recursive:true});
const sources = ['src/core/analysis.js','src/integration/google-photos.js','src/gallery/view.js','src/content/app.js'];
let bundle = '(function () {\n"use strict";\n';
for (const file of sources) {
  execFileSync(process.execPath,['--check',path.join(root,file)]);
  bundle += (await readFile(path.join(root,file),'utf8')).replace(/^export /gm,'') + '\n';
}
const css = (await readFile(path.join(root,'src/content/style.css'),'utf8')).replace(/\r?\n/g,' ');
bundle = bundle.replace('__GALLERYPRO_CSS__',css) + '\n})();\n';
await writeFile(path.join(dist,'gallerypro.js'),bundle.replace(/\r?\n/g,'\r\n'));
await copyFile(path.join(root,'manifest.json'),path.join(dist,'manifest.json'));
await copyFile(path.join(root,'src/content/preferences.js'),path.join(dist,'preferences.js'));
for (const file of await readdir(path.join(root,'assets'))) await copyFile(path.join(root,'assets',file),path.join(dist,'assets',file));
for (const file of ['LICENSE','THIRD_PARTY_NOTICES.md']) await copyFile(path.join(root,file),path.join(dist,file));
execFileSync(process.execPath,['--check',path.join(dist,'gallerypro.js')]);
console.log('GalleryPRO compilado en dist/');
