import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitize from 'sanitize-html';
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (route = '') => base + '/' + route.replace(/^\/+/, '');
const root = path.resolve('content');
function readGroup(folder, parse) {
  return fs.readdirSync(path.join(root,folder)).map(name => parse(fs.readFileSync(path.join(root,folder,name),'utf8'))).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export const profile = JSON.parse(fs.readFileSync(path.join(root,'profile.json'),'utf8'));
export const posts = readGroup('posts', text => { const {data,content}=matter(text); return {...data,body:content.trim()}; });
export const albums = readGroup('albums', JSON.parse);
export const adminUrl = base ? (process.env.PRIMARY_ORIGIN ? process.env.PRIMARY_ORIGIN.replace(/\/$/,'')+'/admin/' : href('admin/')) : href('admin/');
export function markdown(source) {
  return sanitize(marked.parse(source),{allowedTags:['p','br','h2','h3','h4','blockquote','ul','ol','li','strong','em','a','img','pre','code','hr','del','table','thead','tbody','tr','td','th'],allowedAttributes:{a:['href','rel'],img:['src','alt','loading']},allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,transformTags:{img:(_,a)=>({tagName:'img',attribs:{alt:a.alt||'',src:/^\/?(?:media|art)\/[\w-]+\.webp$/.test(a.src||'')?href(a.src):'',loading:'lazy'}}),a:(_,a)=>({tagName:'a',attribs:{href:a.href||'',rel:'noopener noreferrer'}})}});
}
export const records = {profile,posts,albums};
export const recordsSummary = {profile:profile.version,posts:Object.fromEntries(posts.map(x=>[x.id,x.version])),albums:Object.fromEntries(albums.map(x=>[x.id,x.version]))};
