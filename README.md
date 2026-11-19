# Noel AI Consulting Ltd — website

Static two-page site ("Marble & Machine"). No build step, no dependencies.

```
index.html          Home
practice.html       Practice & Contact (+ #contact, #privacy)
styles.css          Shared styles
main.js             Shared behaviour (vanilla JS)
assets/             Dithered bust + capital (grayscale source for the canvas, PNG fallback)
favicon.svg / favicon-32.png / apple-touch-icon.png / og-image.png
```

## Preview locally

Use a local server (the canvas dithering reads image pixels, which browsers block on `file://`;
on `file://` the site falls back to the static 1-bit PNG):

```
cd /path/to/this/folder
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000 in your browser.

## Placeholders to replace (search for the brackets)

| Placeholder | Where |
|---|---|
| `[REGISTERED OFFICE ADDRESS]` | footer (both pages) |
| `[FORM ENDPOINT]` | `action` of `#contact-form` in `practice.html` (e.g. `https://formspree.io/f/xxxxxxxx`) |

## Make the site public on Google

Both pages contain `<meta name="robots" content="noindex, nofollow">` with an explanatory comment.
Delete that line in `index.html` and `practice.html`, then redeploy.

## Deploy

**Netlify**: Add new site → Deploy manually (drag the folder) or connect the repo. Build command: none. Publish directory: `/` (project root).
Then Domain management → Add a domain → follow the DNS prompts (CNAME/ALIAS to the Netlify site, or use Netlify DNS). HTTPS is automatic.

**Cloudflare Pages**: Workers & Pages → Create → Pages → upload the folder or connect the repo. Framework preset: None. Build command: none. Output directory: `/`.
Then Custom domains → Set up a domain. HTTPS is automatic.

## Image credits

The Metropolitan Museum of Art, Open Access (CC0): *Marble head of Demosthenes* (2012.479.9) and
*Marble pilaster capital* (26.60.84). Rendered as 1-bit ordered dither (Bayer 8×8) for this site.
