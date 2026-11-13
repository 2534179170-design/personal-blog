const toolButtons = [...document.querySelectorAll('[data-tool]')];
const panels = {tier:document.querySelector('#tier-tool'), grid:document.querySelector('#grid-tool')};
function openTool(name) {
  if (!panels[name]) return;
  for (const button of toolButtons) button.setAttribute('aria-pressed', String(button.dataset.tool === name));
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
  history.replaceState(null, '', '#' + name);
}
toolButtons.forEach(button => button.addEventListener('click', () => openTool(button.dataset.tool)));
if (panels[location.hash.slice(1)]) openTool(location.hash.slice(1));

const filesInput = document.querySelector('#tier-files');
const pool = document.querySelector('#tier-pool');
const tierRows = [...document.querySelectorAll('.tier-row')];
const tierStatus = document.querySelector('#tier-status');
const tierCount = document.querySelector('#tier-count');
const tierImages = new Map();
let selectedImage = null;
let sequence = 0;

function makeImageCard(item) {
  const card = document.createElement('div');
  card.className = 'tier-card';
  card.dataset.id = item.id;
  card.draggable = true;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `选择 ${item.name}`);
  const img = document.createElement('img');
  img.src = item.url;
  img.alt = '';
  const name = document.createElement('span');
  name.textContent = item.name;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-card';
  remove.setAttribute('aria-label', `移除 ${item.name}`);
  remove.textContent = '×';
  remove.addEventListener('click', event => {
    event.stopPropagation();
    URL.revokeObjectURL(item.url);
    tierImages.delete(item.id);
    card.remove();
    if (selectedImage === item.id) selectedImage = null;
    updatePoolCount();
  });
  card.append(img, name, remove);
  card.addEventListener('click', () => selectImage(item.id));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectImage(item.id); }
  });
  card.addEventListener('dragstart', event => {
    selectImage(item.id);
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'move';
  });
  return card;
}
function selectImage(id) {
  selectedImage = id;
  document.querySelectorAll('.tier-card').forEach(card => card.classList.toggle('selected', card.dataset.id === id));
  tierStatus.textContent = '已选中图片。点排行行放入，也可拖动。';
}
function updatePoolCount() { tierCount.textContent = pool.querySelectorAll('.tier-card').length; }
function moveImage(id, destination) {
  const card = [...document.querySelectorAll('.tier-card')].find(node => node.dataset.id === id);
  if (!card) return;
  destination.append(card);
  selectedImage = null;
  card.classList.remove('selected');
  updatePoolCount();
  tierStatus.textContent = '已调整排行。';
}
function bindDrop(target) {
  target.addEventListener('dragover', event => { event.preventDefault(); target.classList.add('drag-over'); });
  target.addEventListener('dragleave', () => target.classList.remove('drag-over'));
  target.addEventListener('drop', event => {
    event.preventDefault();
    target.classList.remove('drag-over');
    moveImage(event.dataTransfer.getData('text/plain'), target);
  });
  target.addEventListener('click', event => {
    if (selectedImage && !event.target.closest('.tier-card')) moveImage(selectedImage, target);
  });
}
bindDrop(pool);
tierRows.forEach(row => bindDrop(row.querySelector('.tier-items')));
filesInput.addEventListener('change', () => {
  let count = 0;
  for (const file of filesInput.files) {
    if (!file.type.startsWith('image/') || file.size > 15_000_000 || tierImages.size >= 80) continue;
    const item = {id:String(++sequence), name:file.name.replace(/\.[^.]+$/, '').slice(0, 30), url:URL.createObjectURL(file)};
    tierImages.set(item.id, item);
    pool.append(makeImageCard(item));
    count++;
  }
  filesInput.value = '';
  updatePoolCount();
  tierStatus.textContent = count ? `已导入 ${count} 张图片。` : '未导入图片：最多 80 张，每张不超过 15 MB。';
});
document.querySelector('#tier-clear').addEventListener('click', () => {
  for (const item of tierImages.values()) URL.revokeObjectURL(item.url);
  tierImages.clear();
  document.querySelectorAll('.tier-card').forEach(card => card.remove());
  selectedImage = null;
  updatePoolCount();
  tierStatus.textContent = '排行已清空。';
});
window.addEventListener('pagehide', () => { for (const item of tierImages.values()) URL.revokeObjectURL(item.url); });

const slots = [...document.querySelectorAll('.anime-cell')];
const results = document.querySelector('#anime-results');
const query = document.querySelector('#anime-query');
const searchStatus = document.querySelector('#search-status');
const selectedSlotLabel = document.querySelector('#selected-slot');
const gridItems = Array(9).fill(null);
let activeSlot = null;
let searchRequest;

function selectSlot(index) {
  activeSlot = index;
  slots.forEach((slot, i) => slot.classList.toggle('active', i === index));
  selectedSlotLabel.textContent = `正在填写第 ${index + 1} 格：${slots[index].querySelector('.cell-label').value}`;
  query.focus();
}
slots.forEach((slot, index) => {
  slot.querySelector('.cell-select').addEventListener('click', () => selectSlot(index));
  slot.querySelector('.cell-remove').addEventListener('click', () => {
    gridItems[index] = null;
    slot.querySelector('img').hidden = true;
    slot.querySelector('img').removeAttribute('src');
    slot.querySelector('.cell-title').textContent = '';
    slot.querySelector('.cell-remove').hidden = true;
  });
  slot.querySelector('.cell-label').addEventListener('input', () => {
    if (activeSlot === index) selectedSlotLabel.textContent = `正在填写第 ${index + 1} 格：${slot.querySelector('.cell-label').value}`;
  });
});

async function searchAnime() {
  const keyword = query.value.trim();
  if (!keyword) { searchStatus.textContent = '请输入番剧名称。'; return; }
  searchRequest?.abort();
  searchRequest = new AbortController();
  results.replaceChildren();
  searchStatus.textContent = '正在检索 Bangumi…';
  try {
    const response = await fetch('https://api.bgm.tv/v0/search/subjects?limit=15', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({keyword, filter:{type:[2]}}), signal:searchRequest.signal
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const entries = Array.isArray(data.data) ? data.data : [];
    for (const entry of entries) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.src = entry.images?.small || entry.images?.grid || '';
      const text = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = entry.name_cn || entry.name;
      const detail = document.createElement('small');
      detail.textContent = [entry.name_cn && entry.name_cn !== entry.name ? entry.name : '', entry.date || ''].filter(Boolean).join(' · ');
      text.append(title, detail);
      button.append(image, text);
      button.addEventListener('click', () => {
        if (activeSlot === null) { searchStatus.textContent = '请先点选九宫格中的一个格子。'; return; }
        const item = {id:entry.id, title:entry.name_cn || entry.name, image:entry.images?.common || entry.images?.medium || entry.images?.small || ''};
        gridItems[activeSlot] = item;
        const slot = slots[activeSlot];
        const cover = slot.querySelector('img');
        cover.src = item.image;
        cover.hidden = false;
        slot.querySelector('.cell-title').textContent = item.title;
        slot.querySelector('.cell-remove').hidden = false;
        searchStatus.textContent = `已填入第 ${activeSlot + 1} 格：${item.title}`;
      });
      li.append(button);
      results.append(li);
    }
    searchStatus.textContent = entries.length ? `找到 ${entries.length} 部动画，点选后填入当前格子。` : '没有找到匹配的动画，请换个名称试试。';
  } catch (error) {
    if (error.name !== 'AbortError') searchStatus.textContent = '暂时无法连接 Bangumi，请稍后重试。';
  }
}
document.querySelector('#anime-search').addEventListener('click', searchAnime);
query.addEventListener('keydown', event => { if (event.key === 'Enter') searchAnime(); });

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')];
}
function rounded(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function crop(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
function imageFrom(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function download(element, name) {
  element.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');
}
function fitText(ctx, text, maxWidth) {
  let value = text;
  while (value.length > 1 && ctx.measureText(value).width > maxWidth) value = value.slice(0, -1);
  return value === text ? value : value + '…';
}

document.querySelector('#tier-export').addEventListener('click', async () => {
  const button = document.querySelector('#tier-export');
  button.disabled = true;
  tierStatus.textContent = '正在生成排行图…';
  try {
    const width = 1400, margin = 44, labelWidth = 160, imageWidth = 112, imageHeight = 112;
    const layouts = tierRows.map(row => {
      const cards = [...row.querySelectorAll('.tier-card')];
      const columns = Math.max(1, Math.floor((width - margin * 2 - labelWidth - 30) / (imageWidth + 12)));
      return {row, cards, height:Math.max(134, Math.ceil(cards.length / columns) * (imageHeight + 12) + 24), columns};
    });
    const height = 128 + layouts.reduce((sum, item) => sum + item.height, 0) + 60;
    const [element, ctx] = canvas(width, height);
    ctx.fillStyle = '#fbf9fc'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#2d2734'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('从夯到拉 · 我的排行', margin, 68);
    ctx.fillStyle = '#887d8c'; ctx.font = '18px sans-serif'; ctx.fillText('凉宫洺雪的小站 · 自制排行', margin, 101);
    const colors = ['#e7a7b9','#efc099','#f2dca6','#c6d4c9','#bfc6d8'];
    let y = 128;
    for (const [index, layout] of layouts.entries()) {
      rounded(ctx, margin, y, width - margin * 2, layout.height - 7, 16, '#fff');
      rounded(ctx, margin, y, labelWidth, layout.height - 7, 16, colors[index]);
      ctx.fillStyle = '#322a35'; ctx.font = 'bold 28px sans-serif';
      ctx.fillText(fitText(ctx, layout.row.querySelector('input').value || '未命名', labelWidth - 24), margin + 14, y + 48);
      for (const [n, card] of layout.cards.entries()) {
        const x = margin + labelWidth + 18 + n % layout.columns * (imageWidth + 12);
        const itemY = y + 10 + Math.floor(n / layout.columns) * (imageHeight + 12);
        const item = tierImages.get(card.dataset.id);
        try { crop(ctx, await imageFrom(item.url), x, itemY, imageWidth, imageWidth); }
        catch { rounded(ctx, x, itemY, imageWidth, imageWidth, 5, '#eee6ef'); }
        ctx.fillStyle = '#342c36'; ctx.font = '12px sans-serif';
        ctx.fillText(fitText(ctx, item.name, imageWidth), x, itemY + imageWidth + 13);
      }
      y += layout.height;
    }
    download(element, '从夯到拉-排行.png');
    tierStatus.textContent = '排行图已保存到本地。';
  } catch { tierStatus.textContent = '生成失败，请减少图片数量后重试。'; }
  finally { button.disabled = false; }
});

document.querySelector('#grid-export').addEventListener('click', async () => {
  const button = document.querySelector('#grid-export');
  button.disabled = true;
  searchStatus.textContent = '正在生成九宫格…';
  try {
    const [element, ctx] = canvas(1200, 1370);
    ctx.fillStyle = '#fbf9fc'; ctx.fillRect(0, 0, 1200, 1370);
    ctx.fillStyle = '#2d2734'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('我的动漫九宫格', 48, 75);
    ctx.fillStyle = '#887d8c'; ctx.font = '18px sans-serif'; ctx.fillText('凉宫洺雪的小站 · Bangumi 番剧', 48, 105);
    const size = 352, gap = 24;
    for (let i = 0; i < 9; i++) {
      const x = 48 + i % 3 * (size + gap), y = 140 + Math.floor(i / 3) * (size + gap);
      rounded(ctx, x, y, size, size, 14, '#eee8f0');
      const item = gridItems[i];
      if (item?.image) {
        try { crop(ctx, await imageFrom(item.image), x, y, size, size); }
        catch { rounded(ctx, x, y, size, size, 14, '#eee8f0'); }
      }
      ctx.fillStyle = '#241c2bcc'; ctx.fillRect(x, y + size - 78, size, 78);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 21px sans-serif';
      ctx.fillText(fitText(ctx, slots[i].querySelector('.cell-label').value || `第 ${i + 1} 格`, size - 24), x + 12, y + size - 44);
      ctx.font = '16px sans-serif';
      ctx.fillText(fitText(ctx, item?.title || '尚未填写', size - 24), x + 12, y + size - 17);
    }
    download(element, '我的动漫九宫格.png');
    searchStatus.textContent = '九宫格图片已保存到本地。';
  } catch { searchStatus.textContent = '生成失败，请稍后再试。'; }
  finally { button.disabled = false; }
});
