import test from 'node:test';
import assert from 'node:assert/strict';
import {markup,publicSummary} from '../src/lib/markup.mjs';
import {validateRecord} from '../src/lib/validate.mjs';

test('正文和摘要中的剧透默认折叠，未闭合的块也不会泄露摘要',()=>{
  const open='开头\n\n:::剧透 第一集 <提示>\n**结局**\n';
  for(const content of [open,open+':::\n\n结尾']){
    assert.match(markup.parse(content),/<details><summary>第一集 &lt;提示&gt;<\/summary>/);
    assert.match(markup.parse(content),/<strong>结局<\/strong>/);
    assert.doesNotMatch(publicSummary(content),/结局/);
  }
  assert.match(publicSummary(open+':::\n\n结尾'),/结尾/);
  assert.doesNotMatch(markup.parse('```\n:::剧透\n```'),/<details>/);
});

test('旧相册兼容新字段，剧透照片与条目编号可以保存',()=>{
  const data={title:'截图',date:'2026-01-01',description:'',photos:[{src:'art/desk.webp',thumb:'art/desk.webp',caption:''}]};
  const validate=()=>validateRecord('albums','album','initial',data);
  assert.equal(validate().photos[0].spoiler,'');
  data.works=[{id:'123',title:'关联游戏'}];data.photos[0].spoiler='含结局';
  assert.equal(validate().works[0].id,'123');assert.equal(validate().photos[0].spoiler,'含结局');
  data.works.push(data.works[0]);assert.throws(validate);
});

test('个人资料校验年度最爱及友链网址',()=>{
  const data={siteName:'小站',nickname:'站主',signature:'',bio:'',avatar:'',cover:'',links:[],friends:[{label:'友站',url:'https://example.org',note:'推荐'}],favorites:[{year:'2026',title:'游戏',note:'喜欢音乐'}]};
  const validate=()=>validateRecord('profile','profile','initial',data);
  assert.equal(validate().friends[0].note,'推荐');assert.equal(validate().favorites[0].year,'2026');
  data.friends[0].url='javascript:void(0)';assert.throws(validate);
});
