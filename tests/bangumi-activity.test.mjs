import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTimeline,normalizeCollections,mergeActivity} from '../src/lib/bangumi-activity.mjs';
import {onRequest} from '../functions/api/[[route]].js';

const subject = {id:123, name:'雪夜', type:2, images:{small:'https://lain.bgm.tv/pic/cover.jpg'}};
const row = (id, overrides={}) => ({id, uid:828732, cat:3, type:10, createdAt:1794000000,
  memo:{subject:[{subject,rate:8,comment:'喜欢这部作品'}]}, ...overrides});

test('动态只展示站主公开记录，并保留作品链接和追番进度',()=>{
  const records=[
    row(1),
    row(2,{uid:42}),
    row(3,{memo:{subject:[{subject:{...subject,nsfw:true}}]}}),
    row(4,{cat:4,type:2,memo:{progress:{single:{subject,episode:{sort:3,name:'第三话'}}}}}),
    row(5),
  ];
  const events=normalizeTimeline(records);
  assert.equal(events.length,3);
  assert.equal(events[0].url,'https://chii.in/subject/123');
  assert.equal(events[0].cover,subject.images.small);
  assert.equal(events[1].detail,'第 3 话 · 第三话');
  assert.equal(events[2].id,5);
});

test('公开动态接口不依赖站主登录配置',async()=>{
  const originalFetch=globalThis.fetch;
  const latest={subject_id:456,subject_type:2,type:3,updated_at:'2026-11-13T08:20:49Z',subject:{name_cn:'起风了',images:{small:'https://lain.bgm.tv/pic/new.jpg'}},private:false};
  assert.equal(normalizeCollections({data:[latest,{...latest,private:true}]}).length,1);
  assert.equal(mergeActivity(normalizeCollections({data:[latest]}),normalizeTimeline([row(6)]))[0].title,'起风了');
  globalThis.fetch=async url=>Response.json(url.includes('/collections?')?{data:[latest]}:[row(6)]);
  try {
    const response=await onRequest({request:new Request('https://example.test/api/activity'),env:{}});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.events.length,2);
    assert.equal(data.events[0].title,'起风了');
  } finally { globalThis.fetch=originalFetch; }
});
