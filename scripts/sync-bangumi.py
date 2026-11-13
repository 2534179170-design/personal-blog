"""将凉宫洺雪的公开日志和超过 300 字的动画短评同步到空间。"""
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
POSTS = ROOT / 'content/posts'
ART = ROOT / 'public/art'
OWNER = 828732
HEADERS = {'User-Agent': '2534179170-design/personal-blog (https://github.com/2534179170-design/personal-blog)'}
SHANGHAI = timezone(timedelta(hours=8))


def fetch(url):
    with urlopen(Request(url, headers=HEADERS), timeout=25) as response:
        return response.read()


def api(url):
    return json.loads(fetch(url))


def save_image(url, name):
    target = ART / name
    if target.exists():
        return
    if not url.startswith('https://lain.bgm.tv/'):
        raise ValueError('图片来源无效')
    with Image.open(BytesIO(fetch(url))) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((1000, 1400))
        image.save(target, 'WEBP', quality=86)


def put_post(meta, body):
    target = POSTS / (meta['id'] + '.md')
    previous = None
    if target.exists():
        lines = target.read_text(encoding='utf-8').splitlines()
        previous = json.loads(lines[1])
        meta['version'] = previous['version']
    else:
        meta['version'] = str(uuid.uuid4())
    result = '---\n' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + '\n---\n\n' + body.strip() + '\n'
    if target.exists() and target.read_text(encoding='utf-8') == result:
        return False
    meta['version'] = str(uuid.uuid4())
    target.write_text('---\n' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + '\n---\n\n' + body.strip() + '\n', encoding='utf-8')
    return True


def collection_page(offset):
    return api(f'https://api.bgm.tv/v0/users/{OWNER}/collections?subject_type=2&limit=100&offset={offset}')


def sync_comments():
    first = collection_page(0)
    offsets = range(100, first['total'], 100)
    with ThreadPoolExecutor(max_workers=3) as pool:
        pages = [first, *pool.map(collection_page, offsets)]
    rows = {row['subject_id']: row for page in pages for row in page['data']}
    if len(rows) != first['total'] or any(page['total'] != first['total'] for page in pages):
        raise ValueError('动画收藏分页不完整，已停止同步')
    active = set()
    changes = 0
    for row in rows.values():
        body = (row['comment'] or '').replace('\r\n', '\n').replace('\r', '\n').strip()
        if row['private'] or len(re.sub(r'\s+', '', body)) <= 300:
            continue
        subject_id = row['subject_id']
        name = row['subject']['name_cn'] or row['subject']['name']
        image = f'anime-cover-{subject_id}.webp'
        save_image(row['subject']['images']['common'], image)
        date = datetime.fromisoformat(row['updated_at'])
        note = '番组计划收藏更新时间：' + date.strftime('%Y-%m-%d %H:%M') + '（北京时间）'
        if row['rate']:
            note += ' · 我的评分：' + str(row['rate']) + '/10'
        meta = {
            'id': f'bangumi-anime-{subject_id}', 'date': date.date().isoformat(),
            'title': f'《{name}》短评', 'tags': ['番组计划短评', '动画'],
            'works': [{'id': str(subject_id), 'title': name}],
            'cover': 'art/' + image, 'summary': re.sub(r'\s+', ' ', body)[:72] + '…'
        }
        content = body + '\n\n' + note + f'\n\n[查看番组计划原始收藏记录](https://api.bgm.tv/v0/users/{OWNER}/collections/{subject_id})'
        if put_post(meta, content):
            changes += 1
            print('更新短评', subject_id)
        active.add(meta['id'])
    return active, changes


def sync_logs():
    first = api(f'https://next.bgm.tv/p1/users/{OWNER}/blogs?limit=100')
    if first['total'] > len(first['data']):
        raise ValueError('日志分页不完整，已停止同步')
    active = set()
    changes = 0
    for item in first['data']:
        if not item['public']:
            continue
        blog_id = item['id']
        entry = api(f'https://next.bgm.tv/p1/blogs/{blog_id}')
        if entry['uid'] != OWNER or not entry['public']:
            raise ValueError('日志作者或公开状态发生变化')
        photos = api(f'https://next.bgm.tv/p1/blogs/{blog_id}/photos')['data']
        subjects = api(f'https://next.bgm.tv/p1/blogs/{blog_id}/subjects')
        pictures = []
        for index, photo in enumerate(photos):
            name = f'bangumi-log-{blog_id}' + (f'-{index+1}' if index else '') + '.webp'
            save_image('https://lain.bgm.tv/pic/photo/l/' + photo['target'], name)
            pictures.append('![日志配图](art/' + name + ')')
        date = datetime.fromtimestamp(entry['createdAt'], SHANGHAI).date().isoformat()
        meta = {
            'id': f'bangumi-{blog_id}', 'date': date, 'title': entry['title'],
            'tags': ['番组计划日志', *entry['tags']],
            'works': [{'id': str(subject['id']), 'title': subject['nameCN'] or subject['name']} for subject in subjects],
            'cover': 'art/bangumi-log-' + str(blog_id) + '.webp' if pictures else '',
            'summary': item['summary'].rstrip('。') + '…'
        }
        content = entry['content'].strip().replace('\r\n', '\n').replace('\r', '\n')
        if pictures:
            content += '\n\n' + '\n\n'.join(pictures)
        content += f'\n\n[在番组计划阅读原文](https://bgm.tv/blog/{blog_id})'
        changes += put_post(meta, content)
        active.add(meta['id'])
    return active, changes


def main():
    comments, comment_changes = sync_comments()
    logs, log_changes = sync_logs()
    removed = 0
    for post in POSTS.glob('bangumi-*.md'):
        if post.stem.startswith('bangumi-anime-'):
            keep = post.stem in comments
        elif re.fullmatch(r'bangumi-\d+', post.stem):
            keep = post.stem in logs
        else:
            continue
        if not keep:
            post.unlink()
            removed += 1
    print(f'短评变更 {comment_changes} 篇，日志变更 {log_changes} 篇，撤下 {removed} 篇')


if __name__ == '__main__':
    main()
