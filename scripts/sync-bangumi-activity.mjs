import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {normalizeTimeline, TIMELINE_API} from '../src/lib/bangumi-activity.mjs';

const target = resolve('public/data/bangumi-activity.json');
const response = await fetch(TIMELINE_API, {
  headers: {'User-Agent': '2534179170-design/personal-blog (https://github.com/2534179170-design/personal-blog)', Accept: 'application/json'},
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`番组计划动态请求失败：${response.status}`);
const events = normalizeTimeline(await response.json());
if (!events.length) throw new Error('番组计划没有返回可展示的公开动态。');
let previous;
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { previous = null; }
if (JSON.stringify(previous?.events) === JSON.stringify(events)) {
  console.log('番组计划动态没有变化。');
} else {
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, JSON.stringify({updatedAt: new Date().toISOString(), events}, null, 2) + '\n', 'utf8');
  console.log(`已同步 ${events.length} 条公开动态。`);
}
