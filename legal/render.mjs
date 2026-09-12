// The five legal pages, from markdown to HTML — one renderer for the site
// build and the app, so the published text is the same bytes everywhere.
//
// The grammar is exactly what legal/*.md uses and nothing more: #/## headings,
// paragraphs, **bold**, "- " and "1. " lists, pipe tables. No links, no
// inline HTML — anything else is escaped and shown as written. Adding a
// construct to a policy means adding it here, deliberately.

export const PAGES = [
  { slug: 'terms', title: 'Terms of Service', short: 'Terms' },
  { slug: 'privacy', title: 'Privacy Policy', short: 'Privacy' },
  { slug: 'acceptable-use', title: 'Acceptable Use Policy', short: 'Acceptable use' },
  { slug: 'refunds', title: 'Refund Policy', short: 'Refunds' },
  { slug: 'accessibility', title: 'Accessibility Statement', short: 'Accessibility' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline: bold only. Everything else is literal text. */
export function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Markdown → HTML body (no wrapper). Headings get ids so a footer can deep
 * link to "refunds#4-slide-packs"; the effective-date line becomes <p class="fc-effective">.
 */
export function render(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const para = [];
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ');
    const eff = /^\*\*Effective date: (.+)\*\*$/.exec(text);
    out.push(eff ? `<p class="fc-effective">Effective date: ${esc(eff[1])}</p>` : `<p>${inline(text)}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    const h = /^(#{1,3}) (.+)$/.exec(line);
    if (h) {
      flushPara();
      const level = h[1].length;
      const text = h[2].trim();
      out.push(`<h${level} id="${slugify(text)}">${inline(text)}</h${level}>`);
      i++; continue;
    }
    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }
    if (/^- /.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }
    if (/^\|/.test(line)) {
      flushPara();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(1).filter((r) => !/^\|\s*-{2,}/.test(r)).map(cells);
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^---+$/.test(line)) { flushPara(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return out.join('\n');
}

/** The footer block every page carries, as markup. `base` prefixes the hrefs ('' on the site, '' in the app). */
export function footerLinks(base = '') {
  return PAGES.map((p) => `<a href="${base}/${p.slug}">${p.short}</a>`).join('');
}
