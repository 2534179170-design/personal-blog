import {collectionPage} from '../lib/bangumi.mjs';

const list = document.querySelector('#collection-list');
const linkedWorks = JSON.parse(list.dataset.works);
const status = document.querySelector('#sync-status');
const grid = document.querySelector('#status-grid');
const statuses = [...grid.querySelectorAll('[data-status]')];
const kinds = [...document.querySelectorAll('[data-kind]')];
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const refresh = document.querySelector('#refresh');
const pageSize = 24;
const stateNames = {
  2: ['想看', '看过', '在看', '搁置', '抛弃'],
  4: ['想玩', '玩过', '在玩', '搁置', '抛弃']
};
let summary = JSON.parse(grid.dataset.groups);
let kind = '2';
let selectedState = '3';
let offset = 0;
let total = 0;
let checkedAt = '';
let activeRequest;

function renderCounts() {
  const group = summary[kind === '2' ? 'anime' : 'game'];
  if (!group?.states) return;
  statuses.forEach(button => {
    const key = button.dataset.countKey;
    const value = key === 'total' ? group.total : group.states[key];
    button.querySelector('strong').textContent = Number(value || 0).toLocaleString('zh-CN');
    button.setAttribute('aria-pressed', String(button.dataset.status === selectedState));
    const index = Number(button.dataset.status);
    if (index) button.querySelector('span').textContent = stateNames[kind][index - 1];
  });
}

async function refreshSummary() {
  try {
    const response = await fetch('/api/stats', {signal:AbortSignal.timeout(20000)});
    if (!response.ok) return;
    const data = await response.json();
    if (data.groups?.anime?.states && data.groups?.game?.states) {
      summary = data.groups;
      renderCounts();
    }
  } catch { /* 静态备用站和网络中断时保留构建时的数字。 */ }
}

function card(entry) {
  const subject = entry.subject || {};
  const row = document.createElement('li');
  const cover = document.createElement('img');
  cover.alt = '';
  cover.loading = 'lazy';
  cover.referrerPolicy = 'no-referrer';
  const image = subject.images?.small || subject.images?.grid || '';
  if (image.startsWith('https://')) cover.src = image;
  row.append(cover);

  const info = document.createElement('div');
  info.className = 'collection-info';
  const title = document.createElement('a');
  title.className = 'collection-title';
  title.href = 'https://chii.in/subject/' + Number(entry.subject_id);
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.textContent = subject.name_cn || subject.name || '未命名作品';
  info.append(title);
  if (subject.name_cn && subject.name && subject.name_cn !== subject.name) {
    const original = document.createElement('span');
    original.className = 'collection-original';
    original.textContent = subject.name;
    info.append(original);
  }
  const meta = document.createElement('div');
  meta.className = 'collection-meta';
  const labels = [stateNames[kind][Number(entry.type) - 1] || '收藏'];
  if (kind === '2' && Number(entry.ep_status) > 0) {
    labels.push('已看 ' + entry.ep_status + (Number(subject.eps) > 0 ? ' / ' + subject.eps : '') + ' 集');
  }
  if (entry.updated_at) labels.push('更新于 ' + new Date(entry.updated_at).toLocaleDateString('zh-CN'));
  for (const label of labels) {
    const chip = document.createElement('span');
    chip.textContent = label;
    meta.append(chip);
  }
  info.append(meta);
  if (entry.comment?.trim()) {
    const comment = document.createElement('span');
    comment.className = 'collection-comment';
    comment.textContent = entry.comment.trim().slice(0, 160);
    info.append(comment);
  }
  if (linkedWorks[entry.subject_id]) {
    const link = document.createElement('a');
    link.className = 'collection-related';
    link.href = linkedWorks[entry.subject_id];
    link.textContent = '相关空间与相册 ↗';
    info.append(link);
  }
  row.append(info);

  const scores = document.createElement('div');
  scores.className = 'collection-scores';
  for (const [label, value] of [
    ['我的评分', Number(entry.rate) > 0 ? entry.rate + ' / 10' : '未评分'],
    ['作品均分', Number(subject.score) > 0 ? Number(subject.score).toFixed(1) + ' / 10' : '暂无']
  ]) {
    const item = document.createElement('div');
    const number = document.createElement('strong');
    number.textContent = value;
    const caption = document.createElement('small');
    caption.textContent = label;
    item.append(number, caption);
    scores.append(item);
  }
  row.append(scores);
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
    const page = await collectionPage(kind, selectedState, pageSize, offset, request.signal);
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
  renderCounts();
  offset = 0;
  update(true);
}));
statuses.forEach(button => button.addEventListener('click', () => {
  selectedState = button.dataset.status;
  renderCounts();
  offset = 0;
  update(true);
}));
previous.addEventListener('click', () => { offset -= pageSize; update(true); });
next.addEventListener('click', () => { offset += pageSize; update(true); });
refresh.addEventListener('click', () => { update(); refreshSummary(); });
function checkVisible() {
  if (!document.hidden && !activeRequest) update();
}
document.addEventListener('visibilitychange', checkVisible);
setInterval(checkVisible, 60000);
setInterval(refreshSummary, 30 * 60 * 1000);
update();
refreshSummary();
