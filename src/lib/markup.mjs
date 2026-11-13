import { Marked } from 'marked';

// 未闭合的剧透块延伸到文末，避免编辑中的草稿提前展开。
const spoiler = {
  name: 'spoiler', level: 'block',
  start(source) { return source.match(/^:::剧透(?:[ \t]|$)/m)?.index; },
  tokenizer(source) {
    const opening = /^:::剧透(?:[ \t]+([^\n]*))?[ \t]*(?:\n|$)/.exec(source);
    if (!opening) return;
    const rest = source.slice(opening[0].length);
    const end = /^:::[ \t]*(?:\n|$)/m.exec(rest);
    const body = end ? rest.slice(0, end.index) : rest;
    return {
      type: 'spoiler', label: opening[1]?.trim() || '含剧透，点击展开',
      raw: end ? source.slice(0, opening[0].length + end.index + end[0].length) : source,
      tokens: this.lexer.blockTokens(body)
    };
  },
  renderer(token) {
    const label = token.label.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    return '<details><summary>' + label + '</summary>' + this.parser.parse(token.tokens) + '</details>\n';
  }
};
export const markup = new Marked({extensions:[spoiler]});
export function publicSummary(text) {
  return (text || '').replace(/^:::剧透(?:[ \t][^\n]*)?(?:\r?\n|$)[\s\S]*?(?:^:::[ \t]*(?:\r?\n|$)|(?![\s\S]))/gm, '〔含剧透〕');
}
