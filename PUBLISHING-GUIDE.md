# Publishing Guide

## From a phone

1. Edit `config.js` once: real `siteUrl` + `basePath`.
2. Create `articles/my-slug.html` with required `#article-data` JSON and article body.
3. Commit on `main`.
4. Actions → Build and Deploy must show green.
5. Open the live Pages URL.

## After every successful build

Automatically updated:

- `index.html`
- `categories/*.html`
- `data/generated/*`
- `sitemap.xml` / `robots.txt`
- Article SEO tags from `#article-data`

Do not hand-edit generated category lists or sitemap.

## Drafts

`"status": "draft"` stays off homepage, search, and sitemap.
