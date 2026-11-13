import { Problem, recordPath, validateRecord, serialize, versionFrom, decideChange } from '../../src/lib/validate.mjs';
import {normalizeTimeline, TIMELINE_API} from '../../src/lib/bangumi-activity.mjs';
const encoder=new TextEncoder(), decoder=new TextDecoder();
const as64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};
const bytes64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>as64(crypto.getRandomValues(new Uint8Array(32)));
const cookie=(name,value,age)=>name+'='+value+'; Path=/api/; Max-Age='+age+'; Secure; HttpOnly; SameSite=Lax';
function getCookie(req,name){return (req.headers.get('Cookie')||'').split('; ').find(s=>s.startsWith(name+'='))?.slice(name.length+1)}
async function cryptKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.SESSION_KEY)),'AES-GCM',false,['encrypt','decrypt'])}
async function seal(env,data){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptKey(env),encoder.encode(JSON.stringify(data)));return as64(iv)+'.'+as64(new Uint8Array(encrypted));}
async function unseal(env,data){
  try{const [iv,cipher]=data.split('.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes64(iv)},await cryptKey(env),bytes64(cipher));const value=JSON.parse(decoder.decode(plain));if(value.until>Date.now())return value;}catch{}
  return null;
}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function redirect(url,cookies){const headers=new Headers({Location:url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:302,headers})}
async function github(token,path,method='GET',body,allowMissing=false){
  const resp=await fetch('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,'User-Agent':'wind-journal-blog',Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(resp.status===404&&allowMissing)return null;
  if(!resp.ok){if(resp.status===409||resp.status===422)throw new Problem(409,'仓库已更新，请重试。');if(resp.status===401)throw new Problem(401,'登录已过期，请重新登录。');throw new Problem(502,'仓库请求失败，请检查博客应用的安装权限并重试。');}
  return resp.json();
}
async function handleAuth(route,request,env,origin){
  const callback=origin+'/api/callback';
  if(route==='login'){
    const state=random(),verifier=random(),challenge=as64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
    const args=new URLSearchParams({client_id:env.GH_CLIENT_ID,redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256'});
    return redirect('https://github.com/login/oauth/authorize?'+args,[cookie('blog_login',await seal(env,{state,verifier,until:Date.now()+600000}),600)]);
  }
  const params=new URL(request.url).searchParams,login=await unseal(env,getCookie(request,'blog_login'));
  if(!login||login.state!==params.get('state')||!params.get('code'))return redirect('/admin/?login=failed',[cookie('blog_login','',0)]);
  const resp=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GH_CLIENT_ID,client_secret:env.GH_CLIENT_SECRET,code:params.get('code'),redirect_uri:callback,code_verifier:login.verifier})});
  const auth=await resp.json();
  if(!auth.access_token)return redirect('/admin/?login=failed',[cookie('blog_login','',0)]);
  const user=await github(auth.access_token,'/user');
  if(String(user.id)!==String(env.BLOG_OWNER_ID))return redirect('/admin/?login=denied',[cookie('blog_login','',0),cookie('blog_session','',0)]);
  const age=Math.min(auth.expires_in||28800,28800);
  return redirect('/admin/',[cookie('blog_login','',0),cookie('blog_session',await seal(env,{token:auth.access_token,user:user.login,id:String(user.id),until:Date.now()+age*1000}),age)]);
}
async function publish(session,env,input){
  const {type,id,expected,requestId,remove=false,files=[]}=input;
  const path=recordPath(type,id);
  if(!/^[0-9a-f-]{36}$/.test(requestId)||typeof remove!=='boolean'||(type==='profile'&&remove))throw new Problem(400,'发布请求无效。');
  const repo='/repos/'+env.BLOG_REPO;
  const gh=(suffix,method,body,missing)=>github(session.token,repo+suffix,method,body,missing);
  const ref=await gh('/git/ref/heads/main');
  const head=ref.object.sha;
  const previous=await gh('/contents/'+path+'?ref='+head,'GET',null,true);
  const version=previous?versionFrom(type,decoder.decode(bytes64(previous.content.replace(/\s/g,'')))):null;
  if(decideChange(version,expected,requestId,remove)==='done')return {accepted:true};
  const tree=[];
  if(!Array.isArray(files)||files.length>60)throw new Problem(400,'一次上传的图片过多。');
  if(remove){tree.push({path,mode:'100644',type:'blob',sha:null});}
  else{
    const data=validateRecord(type,id,requestId,input.data),text=serialize(type,data);
    let total=0;
    for(const file of files){
      if(!/^media\/[a-f0-9-]{36}(-sm)?\.webp$/.test(file.path)||!text.includes(file.path)||typeof file.base64!=='string')throw new Problem(400,'图片附件无效。');
      const bytes=bytes64(file.base64);total+=bytes.length;
      if(bytes.length>2500000||total>20000000||decoder.decode(bytes.slice(0,4))!=='RIFF'||decoder.decode(bytes.slice(8,12))!=='WEBP')throw new Problem(400,'请使用压缩后的网页图片，单次最多 20 MB。');
      const blob=await gh('/git/blobs','POST',{content:file.base64,encoding:'base64'});
      tree.push({path:'public/'+file.path,mode:'100644',type:'blob',sha:blob.sha});
    }
    tree.push({path,mode:'100644',type:'blob',content:text});
  }
  const commit=await gh('/git/commits/'+head);
  const updated=await gh('/git/trees','POST',{base_tree:commit.tree.sha,tree});
  const next=await gh('/git/commits','POST',{message:remove?'撤下博客内容':'更新博客内容',tree:updated.sha,parents:[head]});
  await gh('/git/refs/heads/main','PATCH',{sha:next.sha,force:false});
  return {accepted:true,commit:next.sha};
}
export async function onRequest({request,env,waitUntil}){
  try{
    const url=new URL(request.url),route=url.pathname.replace(/^\/api\//,'').replace(/\/$/,'');
    if(route==='activity'&&request.method==='GET'){
      const cache=typeof caches==='undefined'?null:caches.default;
      const key=new Request(url.origin+'/api/activity');
      try{const cached=await cache?.match(key);if(cached)return cached;}catch{}
      const upstream=await fetch(TIMELINE_API,{headers:{Accept:'application/json','User-Agent':'2534179170-design/personal-blog (https://github.com/2534179170-design/personal-blog)'},signal:AbortSignal.timeout(10000)});
      if(!upstream.ok)throw new Problem(502,'番组计划动态暂时不可用。');
      const events=normalizeTimeline(await upstream.json());
      if(!events.length)throw new Problem(502,'番组计划动态暂时不可用。');
      const response=Response.json({updatedAt:new Date().toISOString(),events},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=120'}});
      if(cache&&waitUntil)waitUntil(cache.put(key,response.clone()).catch(()=>{}));
      return response;
    }
    if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)throw new Problem(403,'请求来源无效。');
    const configured=['SESSION_KEY','GH_CLIENT_ID','GH_CLIENT_SECRET','BLOG_OWNER_ID','BLOG_REPO'].every(k=>env[k]);
    if(!configured){if(route==='session')return json({configured:false});throw new Problem(503,'站主登录尚待配置。');}
    if(['login','callback'].includes(route)&&request.method==='GET')return await handleAuth(route,request,env,url.origin);
    const session=await unseal(env,getCookie(request,'blog_session'));
    const owner=session&&session.id===String(env.BLOG_OWNER_ID);
    if(route==='session'&&request.method==='GET')return json({configured:true,user:owner?session.user:null});
    if(!owner)throw new Problem(401,'请先用站主账号登录。');
    if(route==='logout'&&request.method==='POST'){const response=json({ok:true});response.headers.append('Set-Cookie',cookie('blog_session','',0));return response;}
    if(route==='capacity'&&request.method==='GET'){const r=await github(session.token,'/repos/'+env.BLOG_REPO);return json({kilobytes:r.size});}
    if(route==='deployment'&&request.method==='GET'){
      const sha=url.searchParams.get('commit');
      if(!/^[a-f0-9]{40}$/.test(sha||''))throw new Problem(400,'版本编号无效。');
      // 部署记录来自公开仓库，无需扩展博客应用的写入权限。
      const response=await fetch('https://api.github.com/repos/'+env.BLOG_REPO+'/actions/workflows/primary.yml/runs?head_sha='+sha+'&per_page=1',{headers:{'User-Agent':'wind-journal-blog'}});
      const run=response.ok?(await response.json()).workflow_runs?.[0]:null;
      return json({failed:!!run&&['failure','cancelled','timed_out','action_required'].includes(run.conclusion),log:run?.html_url});
    }
    if(route==='publish'&&request.method==='POST'){
      if(!request.headers.get('Content-Type')?.includes('application/json'))throw new Problem(415,'请求格式无效。');
      const body=await request.text();if(body.length>29000000)throw new Problem(413,'请分批添加照片。');
      return json(await publish(session,env,JSON.parse(body)));
    }
    return json({error:'接口不存在。'},404);
  }catch(e){return json({error:e instanceof Problem?e.message:'请求暂时失败，请保留草稿后重试。'},e instanceof Problem?e.status:500);}
}
