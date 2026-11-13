import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fetchStats} from '../src/lib/bangumi-stats.mjs';

const target=resolve('public/data/bangumi-stats.json');
const next=await fetchStats();
let previous;
try{previous=JSON.parse(await readFile(target,'utf8'));}catch{previous=null;}
if(JSON.stringify(previous?.groups)===JSON.stringify(next.groups))console.log('番组计划收藏统计没有变化。');
else{await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(next,null,2)+'\n');console.log(`已统计 ${next.groups.all.total} 条公开收藏。`);}
