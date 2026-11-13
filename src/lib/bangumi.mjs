export async function collectionPage(kind, state, limit, offset, signal) {
  const url = new URL('https://api.bgm.tv/v0/users/828732/collections');
  url.searchParams.set('subject_type', kind);
  if (state) url.searchParams.set('type', state);
  url.searchParams.set('limit', limit);
  url.searchParams.set('offset', offset);
  const response = await fetch(url,{credentials:'omit',cache:'no-store',signal});
  if (!response.ok) throw new Error('无法读取番组计划收藏。');
  return response.json();
}
export async function completedCollections(kind) {
  const items = new Map();
  let offset = 0;
  while (true) {
    const page = await collectionPage(kind,2,50,offset,AbortSignal.timeout(15000));
    for (const entry of page.data) if (!entry.private) {
      items.set(entry.subject_id, {id:entry.subject_id, title:entry.subject.name_cn||entry.subject.name, year:new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric'}).format(new Date(entry.updated_at))});
    }
    offset += page.data.length;
    if (offset >= page.total || !page.data.length) break;
  }
  return [...items.values()];
}
