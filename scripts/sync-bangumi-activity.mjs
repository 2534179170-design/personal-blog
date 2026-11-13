import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fetchActivity} from '../src/lib/bangumi-activity.mjs';

const target = resolve('public/data/bangumi-activity.json');
const events = await fetchActivity();
let previous;
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { previous = null; }
if (JSON.stringify(previous?.events) === JSON.stringify(events)) {
  console.log('番组计划动态没有变化。');
} else {
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, JSON.stringify({updatedAt: new Date().toISOString(), events}, null, 2) + '\n', 'utf8');
  console.log(`已同步 ${events.length} 条公开动态。`);
}
