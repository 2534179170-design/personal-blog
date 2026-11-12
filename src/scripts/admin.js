import DOMPurify from 'dompurify';
import {marked} from 'marked';
import {allDrafts,putDraft,deleteDraft} from './drafts.js';
import {prepareImage} from './media.js';
const $=id=>document.getElementById(id);
const app=$('editor-app'),base=app.dataset.base;
const url=path=>base+'/'+path.replace(/^\/+/, '');
const typeNames={posts:'文章',albums:'相册',profile:'个人资料'};
let catalog,section='posts',draft,auth=false,busy=false,sequence=0,pendingWrites=Promise.resolve();
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const status=message=>{$('publish-status').textContent=message};
function element(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el}
function action(label,handler){const el=element('button',label);el.type='button';el.onclick=handler;return el}
async function request(path,options={}){
  const response=await fetch(url('api/'+path),{cache:'no-store',...options});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'网络请求未完成，请重试。');
  return data;
}
const freshCatalog=async()=>{const resp=await fetch(url('catalog.json')+'?t='+Date.now(),{cache:'no-store'});if(!resp.ok)throw new Error('无法读取已发布内容。');catalog=await resp.json()};
const getRecord=(type,id)=>type==='profile'?catalog.profile:catalog[type].find(x=>x.id===id);
const list=type=>type==='profile'?[catalog.profile]:catalog[type];
function blank(type){
  const id=crypto.randomUUID(),date=today();
  return type==='posts'?{id,date,title:'',tags:[],summary:'',cover:'',body:''}:{id,date,title:'',description:'',photos:[]};
}
function asset(path){
  if(!path)return '';
  const file=draft?.files.find(f=>f.path===path);
  return file?'data:image/webp;base64,'+file.base64:url(path);
}
function keep(report=true){
  if(!draft)return Promise.resolve();
  const copy=structuredClone(draft),order=++sequence;
  pendingWrites=pendingWrites.catch(()=>{}).then(()=>putDraft(copy));
  pendingWrites.then(()=>{if(report&&order===sequence&&!busy)status('已保存草稿 · 仅此设备可见')},()=>status('草稿保存失败，浏览器存储可能已满，请保留此页面。'));
  return pendingWrites;
}
function changed(){draft.requestId=crypto.randomUUID();draft.accepted=false;keep()}
async function openSection(type){
  if(busy)return;
  await pendingWrites.catch(()=>{});
  section=type;draft=null;$('editor').hidden=true;$('published-link').replaceChildren();status('');
  document.querySelectorAll('[data-open]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.open===type)));
  const host=$('library');host.replaceChildren();const drafts=await allDrafts(),group=drafts.filter(x=>x.type===type);
  if(type!=='profile')host.append(action('新建'+typeNames[type],()=>openEditor(blank(type),null)));
  for(const item of list(type)){
    const saved=group.find(x=>x.data.id===item.id);
    row(item.title||item.siteName,saved?'继续草稿':'编辑',()=>openEditor(item,saved));
  }
  for(const saved of group.filter(d=>!getRecord(type,d.data.id)))row(saved.data.title||'未命名草稿','继续草稿',()=>openEditor(saved.data,saved));
  function row(title,label,handler){const r=element('div',null,'library-row');r.append(element('span',title),action(label,handler));host.append(r)}
}
function openEditor(item,saved){
  draft=saved||{key:section+'/'+item.id,type:section,data:structuredClone(item),expected:item.version||null,files:[],requestId:crypto.randomUUID(),accepted:false};
  $('editor').hidden=false;$('published-link').replaceChildren();status(saved?'已恢复本机草稿':'');renderFields();
  if(draft.accepted)monitor(draft.accepted);
}
function field(label,key,kind='input',rows=3){
  const wrap=element('label',null,'field');wrap.append(element('span',label));
  const el=element(kind==='textarea'?'textarea':'input');el.dataset.key=key;
  if(kind==='date')el.type='date';if(kind==='textarea')el.rows=rows;
  el.value=key==='tags'?draft.data.tags.join('，'):key==='links'?draft.data.links.map(l=>l.label+' | '+l.url).join('\n'):draft.data[key]||'';
  el.oninput=()=>{
    if(key==='tags')draft.data.tags=el.value.split(/[，,]/).map(s=>s.trim()).filter(Boolean);
    else if(key==='links')draft.data.links=el.value.split('\n').filter(s=>s.trim()).map(line=>{const i=line.indexOf('|');return {label:(i<0?line:line.slice(0,i)).trim(),url:i<0?'':line.slice(i+1).trim()}});
    else draft.data[key]=el.value;changed();
  };
  wrap.append(el);$('fields').append(wrap);return el;
}
function upload(label,multiple,handler){
  const wrap=element('label',label,'upload-label'),el=element('input');el.type='file';el.accept='image/*';el.multiple=multiple;el.setAttribute('aria-label',label);wrap.append(el);
  el.onchange=async()=>{const files=[...el.files];if(!files.length)return;lock(true);try{await handler(files);changed();renderFields()}catch(e){status(e.message)}finally{lock(false);el.value=''}};return wrap;
}
function imageField(key,label){
  const box=element('div');if(draft.data[key]){const img=element('img',null,'edit-image');img.src=asset(draft.data[key]);img.alt=label;box.append(img)}
  box.append(upload(label,false,async([file])=>{const p=await prepareImage(file,false);draft.files.push(...p.files);draft.data[key]=p.src}));
  $('fields').append(box);
}
function renderFields(){
  const data=draft.data,host=$('fields');host.replaceChildren();$('form-title').textContent='编辑'+typeNames[section];
  $('withdraw').hidden=!draft.expected||section==='profile';$('publish').disabled=!auth;
  if(section==='profile'){field('站名','siteName');field('昵称','nickname');field('签名','signature');field('个人介绍','bio','textarea');imageField('avatar','更换头像');imageField('cover','更换首页封面');field('社交链接（每行填写 名称 | 完整网址）','links','textarea');return;}
  field('标题','title');field('日期','date','date');
  if(section==='posts'){
    field('标签（逗号分隔）','tags');field('摘要','summary','textarea',2);imageField('cover','选择文章封面');const tools=element('div',null,'toolbar');host.append(tools);
    const body=field('正文','body','textarea',12);
    function insert(prefix,suffix='',sample=''){
      const start=body.selectionStart,selected=body.value.slice(start,body.selectionEnd);body.setRangeText(prefix+(selected||sample)+suffix,start,body.selectionEnd,'end');body.dispatchEvent(new Event('input'));body.focus();
    }
    for(const [name,prefix,sample] of [['标题','\n## ','小标题'],['引用','\n> ','引用文字'],['列表','\n- ','列表项']])tools.append(action(name,()=>insert(prefix,'',sample)));
    tools.append(upload('插入图片',false,async([file])=>{const img=await prepareImage(file,false);draft.files.push(...img.files);insert('\n!['+file.name.replace(/[\[\]\r\n]/g,'')+']('+img.src+')\n')}));
  }else{
    field('相册说明','description','textarea');host.append(upload('添加照片（可多选）',true,async files=>{
      const prepared=[];for(const file of files)prepared.push(await prepareImage(file,true));
      for(const p of prepared){draft.files.push(...p.files);data.photos.push({src:p.src,thumb:p.thumb,caption:''})}
    }));
    data.photos.forEach((p,i)=>{
      const row=element('div',null,'photo-edit'),img=element('img');img.src=asset(p.thumb);img.alt=p.caption||'照片预览';
      const caption=element('input');caption.placeholder='照片说明';caption.setAttribute('aria-label','第 '+(i+1)+' 张照片说明');caption.value=p.caption;caption.oninput=()=>{p.caption=caption.value;changed()};
      const buttons=element('div',null,'photos-tools');
      function move(j){[data.photos[i],data.photos[j]]=[data.photos[j],data.photos[i]];changed();renderFields()}
      if(i)buttons.append(action('上移',()=>move(i-1)));if(i+1<data.photos.length)buttons.append(action('下移',()=>move(i+1)));
      buttons.append(action('移除',()=>{data.photos.splice(i,1);changed();renderFields()}));row.append(img,caption,buttons);host.append(row);
    });
  }
}
function preview(){
  const data=draft.data,body=$('preview-content');body.replaceChildren(element('h2',data.title||data.siteName||'未命名'));
  if(section==='posts'){
    const container=element('div');
    container.innerHTML=DOMPurify.sanitize(marked.parse(data.body),{ALLOWED_TAGS:['p','br','h2','h3','h4','blockquote','ul','ol','li','strong','em','a','img','pre','code','hr','del','table','thead','tbody','tr','td','th'],ALLOWED_ATTR:['alt','href','src']});
    for(const img of container.querySelectorAll('img')){const p=img.getAttribute('src')||'';if(/^(art|media)\/[\w-]+\.webp$/.test(p))img.src=asset(p);else img.remove()}
    if(data.cover){const cover=element('img');cover.src=asset(data.cover);cover.alt='文章封面';body.append(cover)}
    body.append(container);
  }else if(section==='albums'){body.append(element('p',data.description));for(const p of data.photos){const img=element('img');img.src=asset(p.thumb);img.alt=p.caption;body.append(img,element('p',p.caption))}}
  else{if(data.avatar){const img=element('img',null,'avatar');img.src=asset(data.avatar);body.append(img)}body.append(element('h3',data.nickname),element('p',data.signature),element('p',data.bio));}
  $('preview-dialog').showModal();
}
function lock(value){busy=value;$('workspace').classList.toggle('busy',value);$('editor').inert=value;$('library').inert=value;document.querySelector('.editor-nav').inert=value}
async function send(remove=false){
  if(busy||!auth)return;
  if(remove&&!confirm('确定从网站撤下？公开仓库历史中仍可能保留已发布内容。'))return;
  lock(true);
  try{
    await keep(false);status('正在提交到仓库…');
    const text=JSON.stringify(draft.data);const files=remove?[]:draft.files.filter(f=>text.includes(f.path));
    if(files.length>36||files.reduce((n,f)=>n+f.base64.length,0)>26e6)throw new Error('本次图片过多，请分批发布（每批最多 18 张新相片、约 20 MB）。');
    const payload={type:section,id:draft.data.id,expected:draft.expected,requestId:draft.requestId,remove,data:draft.data,files};
    await request('publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    draft.accepted={remove};await keep(false);await monitor(draft.accepted);
  }catch(e){status('发布失败。'+e.message);lock(false)}
}
async function monitor({remove}){
  lock(true);status('正在上线，已提交到仓库。可以关闭页面，稍后继续查看。');
  const snapshot=draft;
  for(let i=0;i<60;i++){
    try{
      const response=await fetch(url('version.json')+'?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error();
      const versions=await response.json(),v=section==='profile'?versions.profile:versions[section][snapshot.data.id];
      if(remove?!v:v===snapshot.requestId){
        await freshCatalog();await deleteDraft(snapshot.key);lock(false);await openSection(section);status(remove?'已上线 · 内容已撤下':'已上线');
        if(!remove){const a=element('a','打开并分享','share-out');a.href=url(section==='profile'?'about/':section+'/'+snapshot.data.id+'/');$('published-link').append(a)}return;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,4000));
  }
  lock(false);status('尚未确认上线。草稿已保留，请查看部署记录，完成后重新打开草稿。');
}
async function init(){
  if(app.dataset.primary){location.replace(app.dataset.primary);return}
  await freshCatalog();
  let session;
  try{session=await request('session')}catch{session={configured:false}}
  auth=!!session.user;$('login').hidden=!session.configured||auth;$('logout').hidden=!auth;
  const reason=new URLSearchParams(location.search).get('login');
  $('account-info').textContent=auth?'已登录站主 '+session.user:reason==='denied'?'该账号不是本站站主。':reason==='failed'?'登录未完成，请重试。':session.configured?'登录后即可发布；本机可先写草稿。':'此地址仅支持本机草稿，发布需要已配置的主站后台。';
  $('workspace').hidden=false;await openSection('posts');
  if(auth)request('capacity').then(r=>{if(r.kilobytes>=800*1024)$('account-info').textContent+=' · 仓库已接近 1 GB，建议控制图片容量。'}).catch(()=>{});
}
document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openSection(el.dataset.open));
$('editor').onsubmit=e=>{e.preventDefault();send()};$('withdraw').onclick=()=>send(true);$('preview').onclick=preview;
$('close-preview').onclick=()=>$('preview-dialog').close();
$('discard').onclick=async()=>{if(!confirm('丢弃本机这份草稿并读取最新公开版本？'))return;await pendingWrites.catch(()=>{});await deleteDraft(draft.key);await freshCatalog();await openSection(section)};
$('logout').onclick=async()=>{try{await request('logout',{method:'POST'});location.reload()}catch{status('退出失败，请重试。')}};
init().catch(()=>{$('account-info').textContent='暂时无法打开后台，请确认网络及浏览器本地存储可用后刷新。'});
