import { readFile, readdir, unlink, access } from 'node:fs/promises';
import path from 'node:path';

// 通过公开目录校验正文、相册和资料的图片，并从本次构建中排除撤下的展示图。
const catalog=await readFile('dist/catalog.json','utf8');
const refs=new Set(catalog.match(/(?:art\/[a-z0-9-]+|media\/[a-f0-9-]+)\.webp/g)||[]);
for(const reference of refs)await access(path.join('dist',reference));
const files=await readdir('dist/media').catch(e=>{if(e.code==='ENOENT')return [];throw e;});
for(const name of files){
  if(!refs.has('media/'+name))await unlink(path.join('dist/media',name));
}
