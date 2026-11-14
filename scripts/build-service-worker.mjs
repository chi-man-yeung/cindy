import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat()}
const assets=(await walk('.next/static')).filter(p=>/\.(js|css|woff2?)$/.test(p)).map(p=>p.replace('.next/','/_next/'));
const hash=createHash('sha256').update(await readFile('.next/BUILD_ID')).digest('hex').slice(0,16);
const source=await readFile('scripts/service-worker-template.js','utf8');
await writeFile('public/sw.js',source.replace('/*CACHE_NAME*/',JSON.stringify(`cindy-shell-${hash}`)).replace('/*ASSETS*/',JSON.stringify(['/', '/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-180.png',...assets])));
