// Minimal, safe Markdown for trusted server text (headings, lists, bold, italic, paragraphs).
// Builds React elements; never injects HTML.
function inline(text, keyPrefix) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) parts.push(<strong key={`${keyPrefix}-${i++}`}>{token.slice(2, -2)}</strong>);
    else parts.push(<em key={`${keyPrefix}-${i++}`}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ source = '' }) {
  const blocks = [];
  let list = null;
  const lines = source.replace(/\r/g, '').split('\n');
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(<Tag key={`l${blocks.length}`}>{list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>)}</Tag>);
      list = null;
    }
  };
  lines.forEach((line, idx) => {
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const Tag = `h${h[1].length}`;
      blocks.push(<Tag key={idx}>{inline(h[2], `h${idx}`)}</Tag>);
    } else if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul || ol)[1]);
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      blocks.push(<p key={idx}>{inline(line, `p${idx}`)}</p>);
    }
  });
  flush();
  return <div className="markdown">{blocks}</div>;
}
