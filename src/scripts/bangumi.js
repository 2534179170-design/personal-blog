import {collectionPage} from '../lib/bangumi.mjs';
const list = document.querySelector('#collection-list');
const linkedWorks = JSON.parse(list.dataset.works);
const status = document.querySelector('#sync-status');
const state = document.querySelector('#collection-state');
const kinds = document.querySelectorAll('[data-kind]');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const refresh = document.querySelector('#refresh');
const pageSize = 18;
const states = {
  2: ['想看', '看过', '在看', '搁置', '抛弃'],
  4: ['想玩', '玩过', '在玩', '搁置', '抛弃']
};
let kind = '2';
let offset = 0;
let total = 0;
let checkedAt = '';
let activeRequest;

function card(entry) {
  const subject = entry.subject;
  const row = document.createElement('li');
  if (subject.images?.grid?.startsWith('https://')) {
    const cover = document.createElement('img');
    cover.alt = '';
    cover.loading = 'lazy';
    cover.referrerPolicy = 'no-referrer';
    cover.src = subject.images.grid;
    row.append(cover);
  }
  const info = document.createElement('div');
  const title = document.createElement('a');
  title.href = 'https://chii.in/subject/' + Number(entry.subject_id);
  title.textContent = subject.name_cn || subject.name;
  const details = [states[kind][entry.type - 1]];
  if (kind === '2' && entry.ep_status > 0) details.push('已看 ' + entry.ep_status + ' 集');
  if (entry.rate > 0) details.push('我的评分 ' + entry.rate + '/10');
  const meta = document.createElement('small');
  meta.textContent = details.join(' · ');
  info.append(title, meta);
  if (linkedWorks[entry.subject_id]) {
    const link = document.createElement('a');
    link.href = linkedWorks[entry.subject_id];
    link.textContent = '相关空间与相册';
    info.append(link);
  }
  row.append(info);
  return row;
}

async function update(reset = false) {
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  const timeout = setTimeout(() => request.abort(), 12000);
  if (reset) {
    checkedAt = '';
    total = 0;
    list.replaceChildren();
  }
  if (!checkedAt) status.textContent = '正在读取公开收藏…';
  previous.disabled = true;
  next.disabled = true;
  refresh.disabled = true;
  try {
    const page = await collectionPage(kind,state.value,pageSize,offset,request.signal);
    if (request !== activeRequest) return;
    total = page.total;
    if (offset && offset >= total) {
      offset = Math.max(0, Math.floor((total - 1) / pageSize) * pageSize);
      return update(true);
    }
    list.replaceChildren(...page.data.filter(entry => !entry.private).map(card));
    checkedAt = new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'});
    const result = total ? '共 ' + total + ' 部 · 第 ' + (offset / pageSize + 1) + ' / ' + Math.ceil(total / pageSize) + ' 页' : '这个分类还没有公开收藏';
    status.textContent = result + ' · 上次读取 ' + checkedAt;
  } catch {
    if (request === activeRequest) status.textContent = '暂时无法连接番组计划，可稍后刷新。' + (checkedAt ? '当前显示 ' + checkedAt + ' 读取的记录。' : '');
  } finally {
    clearTimeout(timeout);
    if (request === activeRequest) {
      activeRequest = undefined;
      previous.disabled = offset === 0;
      next.disabled = offset + pageSize >= total;
      refresh.disabled = false;
    }
  }
}

kinds.forEach(button => button.addEventListener('click', () => {
  kind = button.dataset.kind;
  kinds.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  for (const option of state.options) option.textContent = states[kind][Number(option.value) - 1] || '全部';
  offset = 0;
  update(true);
}));
state.addEventListener('change', () => { offset = 0; update(true); });
previous.addEventListener('click', () => { offset -= pageSize; update(true); });
next.addEventListener('click', () => { offset += pageSize; update(true); });
refresh.addEventListener('click', () => update());
function checkVisible() {
  if (!document.hidden && !activeRequest) update();
}
document.addEventListener('visibilitychange', checkVisible);
setInterval(checkVisible, 60000);
update();
