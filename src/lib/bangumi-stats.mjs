export const COLLECTIONS_API='https://api.bgm.tv/v0/users/828732/collections';
const kinds={book:1,anime:2,game:4,real:6};

export function summarizeCollections(entries) {
  const groups={all:entries};
  for(const [name,id] of Object.entries(kinds))groups[name]=entries.filter(item=>item.subject_type===id);
  return Object.fromEntries(Object.entries(groups).map(([name,items])=>{
    const visible=items.filter(item=>!item.private);
    const rates=visible.map(item=>Number(item.rate)).filter(rate=>Number.isInteger(rate)&&rate>=1&&rate<=10);
    const average=rates.length?rates.reduce((sum,rate)=>sum+rate,0)/rates.length:0;
    const deviation=rates.length?Math.sqrt(rates.reduce((sum,rate)=>sum+(rate-average)**2,0)/rates.length):0;
    const completed=visible.filter(item=>item.type===2).length;
    const states={want:0,completed:0,doing:0,onHold:0,dropped:0};
    for(const item of visible){const key=({1:'want',2:'completed',3:'doing',4:'onHold',5:'dropped'})[item.type];if(key)states[key]++;}
    return [name,{total:visible.length,completed,states,completionRate:visible.length?Math.round(completed/visible.length*1000)/10:0,
      average:Math.round(average*100)/100,deviation:Math.round(deviation*100)/100,rated:rates.length,
      histogram:Array.from({length:10},(_,index)=>rates.filter(rate=>rate===10-index).length)}];
  }));
}

export async function fetchStats(fetcher=fetch) {
  const get=async offset=>{
    const url=new URL(COLLECTIONS_API);
    url.searchParams.set('limit','100');url.searchParams.set('offset',String(offset));
    const response=await fetcher(url.toString(),{headers:{Accept:'application/json','User-Agent':'2534179170-design/personal-blog (https://github.com/2534179170-design/personal-blog)'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`收藏统计请求失败：${response.status}`);
    const page=await response.json();
    if(!Array.isArray(page.data)||!Number.isSafeInteger(page.total))throw new Error('收藏统计格式无效。');
    return page;
  };
  const first=await get(0),entries=[...first.data];
  for(let offset=100;offset<first.total;offset+=500){
    const offsets=Array.from({length:Math.min(5,Math.ceil((first.total-offset)/100))},(_,index)=>offset+index*100);
    const pages=await Promise.all(offsets.map(get));
    for(const page of pages)entries.push(...page.data);
  }
  return {updatedAt:new Date().toISOString(),groups:summarizeCollections(entries)};
}
