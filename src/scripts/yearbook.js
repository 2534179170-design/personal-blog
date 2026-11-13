import {completedCollections} from '../lib/bangumi.mjs';
const select=document.querySelector('#year');
const load=document.querySelector('#read-year');
const status=document.querySelector('#year-status');
const results=document.querySelector('#year-works');
let groups;
function render() {
  for (const item of document.querySelectorAll('[data-year]')) item.hidden=item.dataset.year!==select.value;
  const entries=[...document.querySelectorAll('#year-entries li:not([hidden])')];
  const posts=entries.filter(item=>item.querySelector('.tag').textContent==='空间').length;
  document.querySelector('#entry-count').textContent=posts+' 篇空间 · '+(entries.length-posts)+' 本相册';
  document.querySelector('#no-favorite').hidden=!!document.querySelector('.year-grid section:nth-child(2) [data-year]:not([hidden])');
  if (!groups) return;
  results.replaceChildren();
  for(const [index, all] of groups.entries()) {
    const works=all.filter(item=>item.year===select.value);
    const section=document.createElement('details');
    const title=document.createElement('summary');
    title.textContent=index===0?'看过动画 · '+works.length+' 部':'玩过游戏 · '+works.length+' 款';
    section.append(title);
    const list=document.createElement('ul');
    list.className='journal-list';
    for(const work of works){
      const li=document.createElement('li'),link=document.createElement('a');
      link.href='https://chii.in/subject/'+work.id;link.textContent=work.title;li.append(link);list.append(li);
    }
    section.append(list);results.append(section);
  }
}
select.onchange=render;
load.onclick=async()=>{
  load.disabled=true;status.textContent='正在汇总动画和游戏收藏…';
  try {
    groups=await Promise.all([completedCollections(2),completedCollections(4)]);
    const years=new Set([...select.options].map(option=>option.value));
    for(const item of groups.flat())years.add(item.year);
    const previous=select.value;
    select.replaceChildren(...[...years].sort().reverse().map(year=>new Option(year,year)));
    select.value=previous;
    render();status.textContent='已读取公开收藏，展开可看作品清单。';load.hidden=true;
  }catch{status.textContent='番组计划暂时无法连接，请稍后重试。'}
  finally{load.disabled=false;}
};
render();
