export const TIMELINE_URL = 'https://chii.in/user/828732/timeline';
export const TIMELINE_API = 'https://next.bgm.tv/p1/users/828732/timeline?limit=20';

const short = (value, length) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, length)
  : '';
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const coverOf = subject => {
  const url = subject?.images?.small || subject?.images?.grid || '';
  return typeof url === 'string' && url.startsWith('https://lain.bgm.tv/') ? url : '';
};

function describe(row) {
  const memo = row.memo || {};
  if (row.cat === 3) {
    const item = Array.isArray(memo.subject) ? memo.subject.find(entry => validId(entry?.subject?.id)) : null;
    const subject = item?.subject;
    if (!subject || subject.nsfw) return null;
    const game = subject.type === 4;
    const actions = game
      ? {2: '想玩', 6: '玩过', 10: '在玩'}
      : {2: '想看', 6: '看过', 10: '在看'};
    const rate = Number(item.rate);
    return {
      group: `collection:${subject.id}`,
      action: actions[row.type] || '更新收藏',
      title: short(subject.nameCN || subject.name, 80),
      detail: short(item.comment, 100) || (rate > 0 && rate <= 10 ? `我的评分 ${rate}/10` : ''),
      cover: coverOf(subject),
      url: `https://chii.in/subject/${subject.id}`,
    };
  }
  if (row.cat === 4) {
    const progress = memo.progress || {};
    const single = progress.single || {};
    const batch = progress.batch || {};
    const subject = single.subject || batch.subject;
    if (!validId(subject?.id) || subject.nsfw) return null;
    const episode = single.episode;
    const episodeName = short(episode?.nameCN || episode?.name, 48);
    const episodeNumber = Number(episode?.sort);
    const batchCount = Number(batch.epsUpdate);
    const detail = episode
      ? `${episodeNumber > 0 ? `第 ${episodeNumber} 话` : '单集进度'}${episodeName ? ` · ${episodeName}` : ''}`
      : batchCount > 0 ? `更新了 ${batchCount} 话` : '';
    return {
      group: `progress:${subject.id}`,
      action: '追番进度',
      title: short(subject.nameCN || subject.name, 80),
      detail,
      cover: coverOf(subject),
      url: `https://chii.in/subject/${subject.id}`,
    };
  }
  if (row.cat === 7 && validId(memo.index?.id) && !memo.index.private) {
    return {
      group: `index:${memo.index.id}`,
      action: '收藏目录',
      title: short(memo.index.title, 80),
      detail: '',
      cover: '',
      url: `https://chii.in/index/${memo.index.id}`,
    };
  }
  return null;
}

export function normalizeTimeline(rows, limit = 8) {
  if (!Array.isArray(rows)) throw new Error('番组计划动态格式无效。');
  const events = [];
  for (const row of rows) {
    if (Number(row?.uid) !== 828732 || !validId(row.id) || !Number.isFinite(row.createdAt)) continue;
    const item = describe(row);
    if (!item?.title) continue;
    const timestamp = new Date(row.createdAt * 1000);
    if (Number.isNaN(timestamp.valueOf())) continue;
    events.push({
      id: row.id,
      action: item.action,
      title: item.title,
      detail: item.detail,
      cover: item.cover,
      url: item.url,
      createdAt: timestamp.toISOString(),
    });
    if (events.length >= limit) break;
  }
  return events;
}
