const tokenPattern=/^[a-z0-9][a-z0-9-]{0,79}$/;
const imagePattern=/^(?:media\/[a-f0-9-]{36}(?:-sm)?|art\/[a-z-]+)\.webp$/;
export class Problem extends Error {
  constructor(status,message){super(message);this.status=status;}
}
function requireValue(value,message){if(!value)throw new Problem(400,message);}
function string(value,max,required=false){
  requireValue(typeof value==='string'&&value.length<=max&&(!required||value.trim()),'请检查必填项或文字长度。');
  return value.trim();
}
function photoPath(value,optional=false){requireValue((optional&&!value)||typeof value==='string'&&imagePattern.test(value),'图片路径无效。');return value||'';}
function day(value){requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value)),'请选择有效日期。');return value;}
export function recordPath(type,id){
  requireValue(tokenPattern.test(id)&&typeof id==='string','内容编号无效。');
  if(type==='profile'&&id==='profile')return 'content/profile.json';
  if(type==='posts')return 'content/posts/'+id+'.md';
  if(type==='albums')return 'content/albums/'+id+'.json';
  throw new Problem(400,'内容类型无效。');
}
export function validateRecord(type,id,version,data){
  requireValue(data&&typeof data==='object'&&tokenPattern.test(version),'内容无效。');
  const common={id,version};
  if(type==='profile'){
    requireValue(Array.isArray(data.links)&&data.links.length<=12,'链接数量过多。');
    const links=data.links.map(x=>{let url;try{url=new URL(x.url)}catch{}requireValue(url&&/^https?:$/.test(url.protocol),'请输入完整的网址。');return {label:string(x.label,48,true),url:url.href}});
    return {...common,siteName:string(data.siteName,40,true),nickname:string(data.nickname,40,true),signature:string(data.signature,160),bio:string(data.bio,6000),avatar:photoPath(data.avatar,true),cover:photoPath(data.cover,true),links};
  }
  const title=string(data.title,120,true),date=day(data.date);
  if(type==='posts'){
    requireValue(Array.isArray(data.tags)&&data.tags.length<=8,'标签最多 8 个。');
    return {...common,title,date,tags:[...new Set(data.tags.map(t=>string(t,24,true)))],summary:string(data.summary,300),cover:photoPath(data.cover,true),body:string(data.body,120000,true)};
  }
  requireValue(Array.isArray(data.photos)&&data.photos.length>0&&data.photos.length<=100,'每本相册应包含 1 到 100 张照片。');
  return {...common,title,date,description:string(data.description,600),photos:data.photos.map(p=>({src:photoPath(p.src),thumb:photoPath(p.thumb),caption:string(p.caption,200)}))};
}
export function serialize(type,record){
  if(type!=='posts')return JSON.stringify(record,null,2)+'\n';
  const {body,...meta}=record;
  return '---\n'+JSON.stringify(meta)+'\n---\n\n'+body+'\n';
}
export function versionFrom(type,text){
  return (type==='posts'?JSON.parse(text.split(/\r?\n/)[1]):JSON.parse(text)).version;
}
export function decideChange(current,expected,requestId,remove){
  if(current===requestId||(!current&&remove))return 'done';
  if(current!==expected)throw new Problem(409,'这份内容已在其他设备修改。草稿已保留，请重新载入最新版再编辑。');
  return 'write';
}
