import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCollections,fetchStats} from '../src/lib/bangumi-stats.mjs';

test('收藏统计过滤私密记录并计算分数分布',()=>{
  const entries=[
    {subject_type:2,type:2,rate:8,private:false},
    {subject_type:2,type:3,rate:6,private:false},
    {subject_type:4,type:2,rate:0,private:false},
    {subject_type:2,type:2,rate:10,private:true},
  ];
  const groups=summarizeCollections(entries);
  assert.equal(groups.all.total,3);
  assert.equal(groups.all.completed,2);
  assert.equal(groups.anime.states.doing,1);
  assert.equal(groups.anime.average,7);
  assert.equal(groups.anime.deviation,1);
  assert.equal(groups.anime.histogram[2],1);
  assert.equal(groups.game.total,1);
});

test('收藏统计分页取得全部记录',async()=>{
  const seen=[];
  const fetcher=async url=>{const offset=Number(new URL(url).searchParams.get('offset'));seen.push(offset);return Response.json({total:101,data:Array.from({length:offset?1:100},()=>({subject_type:2,type:2,rate:7,private:false}))});};
  const data=await fetchStats(fetcher);
  assert.deepEqual(seen,[0,100]);
  assert.equal(data.groups.all.total,101);
});
