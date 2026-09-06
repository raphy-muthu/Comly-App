/**
 * Generates the standalone hosted legal pages from src/legal/content.ts.
 *
 *   node --experimental-strip-types scripts/build-legal-html.mjs
 *   (or `npm run legal:html`; Node 23+ strips types without the flag)
 *
 * Why generate rather than hand-write: the App Store and Play Console point at
 * public URLs, and the app renders the same documents natively. Two hand-kept
 * copies of a legal document is exactly the kind of drift that ends with a
 * store listing citing terms nobody in the app ever agreed to. The TypeScript
 * module is the single source; these files are build output.
 *
 * The output is deliberately dependency-free static HTML — no framework, no
 * CDN, no JavaScript — so it can be dropped on any host (S3, Netlify, GitHub
 * Pages, a folder on the marketing site) and will still render if everything
 * else is down.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../src/legal/content.ts';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'legal');

const escape = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Consecutive `li` blocks have to be wrapped in a single <ul>, not one each. */
function renderBlocks(blocks) {
  const out = [];
  let inList = false;

  for (const block of blocks) {
    if (block.type === 'li') {
      if (!inList) {
        out.push('  <ul>');
        inList = true;
      }
      out.push(`    <li>${escape(block.text)}</li>`);
      continue;
    }
    if (inList) {
      out.push('  </ul>');
      inList = false;
    }
    const tag = block.type === 'h2' ? 'h2' : block.type === 'h3' ? 'h3' : 'p';
    out.push(`  <${tag}>${escape(block.text)}</${tag}>`);
  }
  if (inList) out.push('  </ul>');

  return out.join('\n');
}

function renderPage(doc) {
  const attribution = doc.attribution
    ? `\n  <p class="attribution">${escape(doc.attribution.text)}<a href="${escape(
        doc.attribution.url
      )}" target="_blank" rel="noopener external">${escape(
        doc.attribution.linkLabel
      )}</a></p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(doc.title)} · Comly</title>
<meta name="description" content="Comly ${escape(doc.title)}, last updated ${escape(
    doc.lastUpdated
  )}.">
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --ink: #1b1a20;
    --muted: #4b4956;
    --rule: #e4e2e9;
    --accent: #4c1d95;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131118;
      --ink: #eceaf2;
      --muted: #b3aec0;
      --rule: #2c2934;
      --accent: #c4b5fd;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 .35rem; }
  h2 { font-size: 1.15rem; margin: 2.25rem 0 .5rem; }
  h3 { font-size: 1rem; margin: 1.5rem 0 .35rem; }
  p, li { color: var(--muted); }
  p { margin: 0 0 .85rem; }
  ul { margin: 0 0 .85rem; padding-left: 1.25rem; }
  li { margin-bottom: .4rem; }
  .meta {
    color: var(--muted);
    font-size: .85rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--rule);
    margin-bottom: .5rem;
  }
  .attribution { margin-top: 2.5rem; font-size: .85rem; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>${escape(doc.title)}</h1>
  <p class="meta">Comly · Last updated ${escape(doc.lastUpdated)} · Version ${escape(
    doc.version
  )}</p>
${renderBlocks(doc.blocks)}${attribution}
</main>
</body>
</html>
`;
}

await mkdir(OUT_DIR, { recursive: true });
for (const [file, doc] of [
  ['terms.html', TERMS_OF_SERVICE],
  ['privacy.html', PRIVACY_POLICY],
]) {
  await writeFile(join(OUT_DIR, file), renderPage(doc), 'utf8');
  console.log(`wrote web/legal/${file}`);
}
