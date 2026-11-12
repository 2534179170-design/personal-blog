import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,versionFrom,serialize,decideChange,recordPath} from '../src/lib/validate.mjs';
import {onRequest} from '../functions/api/[[route]].js';
const env={GH_CLIENT_ID:'local',GH_CLIENT_SECRET:'test-only',SESSION_KEY:'test-only-random-key',BLOG_OWNER_ID:'7',BLOG_REPO:'tester/demo'};
const origin='https://test.invalid';
const doc={id:'one',title:'手记',body:'正文',date:'2026-11-12',tags:['随笔'],summary:'',cover:''};
const version='0a343892-2f3b-42b7-ae82-78260f64ab35';
test('正文序列化并保留发布编号',()=>{const d=validateRecord('posts','one',version,doc);assert.equal(versionFrom('posts',serialize('posts',d)),version);});
test('相同操作可重试，过期草稿不能覆盖新版',()=>{assert.equal(decideChange(version,null,version,false),'done');assert.throws(()=>decideChange('new','old',version,false),e=>e.status===409);assert.equal(decideChange(null,'old',version,true),'done')});
test('内容必须位于指定目录',()=>{assert.throws(()=>recordPath('posts','bad/name'));assert.throws(()=>recordPath('profile','other'));assert.equal(recordPath('albums','one'),'content/albums/one.json')});
const hit=(route,init={},settings=env)=>onRequest({request:new Request(origin+'/api/'+route,init),env:settings});
test('未登录、跨站和未配置的请求',async()=>{assert.equal((await hit('publish',{method:'POST',headers:{Origin:origin}})).status,401);assert.equal((await hit('logout',{method:'POST'})).status,403);assert.deepEqual(await (await hit('session',{},{})).json(),{configured:false})});
test('回调缺少之前发起的登录时回到中文提示',async()=>{const r=await hit('callback?code=test');assert.equal(r.headers.get('Location'),'/admin/?login=failed')});
test('登录会生成一次性状态与校验参数',async()=>{const r=await hit('login');const target=new URL(r.headers.get('Location'));assert.equal(target.host,'github.com');assert.ok(target.searchParams.get('code_challenge'));assert.match(r.headers.get('Set-Cookie'),/HttpOnly/)});
test('使用模拟仓库验证登录、拒绝其他账号、原子发布、冲突与撤下',async t=>{
  const content=new Map(),trees=new Map(),commits=new Map();
  let owner=7,index=0,head='initial',pendingTree;
  t.mock.method(globalThis,'fetch',async(location,options={})=>{
    const p=new URL(location).pathname,b=options.body?JSON.parse(options.body):{};
    if(p.includes('access_token'))return Response.json({access_token:'test-session',expires_in:300});
    if(p==='/user')return Response.json({id:owner,login:'tester'});
    if(p.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:head}});
    if(p.includes('/contents/')){const v=content.get(p.split('/contents/')[1]);return v?Response.json({content:Buffer.from(v).toString('base64')}):new Response(null,{status:404})}
    if(p.includes('/git/commits/'))return Response.json({tree:{sha:'tree'}});
    if(p.endsWith('/git/trees')){pendingTree=b.tree;const sha='t'+index;trees.set(sha,b.tree);return Response.json({sha})}
    if(p.endsWith('/git/commits')){const sha='c'+(++index);commits.set(sha,b);return Response.json({sha})}
    if(p.endsWith('/git/refs/heads/main')){assert.equal(b.force,false);assert.equal(commits.get(b.sha).parents[0],head);head=b.sha;for(const item of pendingTree){if(item.sha===null)content.delete(item.path);else content.set(item.path,item.content)}return Response.json({})}
    throw Error('意外的请求 '+p);
  });
  async function login(){
    const r=await hit('login');const target=new URL(r.headers.get('Location'));
    return hit('callback?code=test&state='+target.searchParams.get('state'),{headers:{Cookie:r.headers.getSetCookie()[0].split(';')[0]}});
  }
  owner=19;assert.match((await login()).headers.get('Location'),/denied/);
  owner=7;const cookie=(await login()).headers.getSetCookie().find(x=>x.startsWith('blog_session=')).split(';')[0];
  const post=(changes={})=>hit('publish',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({type:'posts',id:'one',expected:null,requestId:version,data:doc,files:[],...changes})});
  assert.equal((await post()).status,200);assert.equal(content.size,1);assert.equal((await post()).status,200);assert.equal(index,1);
  const next=crypto.randomUUID();assert.equal((await post({requestId:next})).status,409);
  assert.equal((await post({remove:true,expected:version,requestId:next})).status,200);assert.equal(content.size,0);
});
