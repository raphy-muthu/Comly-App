# Hosted legal pages

Generated files — **do not edit by hand.** The source is
[`src/legal/content.ts`](../../src/legal/content.ts), which the app also renders
natively. Regenerate after any change to the documents:

```bash
npm run legal:html
```

## Hosting

These are dependency-free static pages. Drop them on any host and map the
extensionless paths so the published URLs match what the app and the store
listings link to:

| Public URL                   | File           |
| ---------------------------- | -------------- |
| `https://comly.app/terms`    | `terms.html`   |
| `https://comly.app/privacy`  | `privacy.html` |

Netlify (`_redirects`), Vercel (`rewrites`), Cloudflare Pages and S3 static
hosting all support this; on plain nginx it is `try_files $uri $uri.html`.

The origin is declared once, as `LEGAL_ORIGIN` in `src/legal/content.ts`. It is
also a deep-link prefix, so on a device with Comly installed these URLs open the
in-app screens instead of the browser. Change it there, not here.
