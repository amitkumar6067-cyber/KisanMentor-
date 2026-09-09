# KisanMentor

Knowledge-first agriculture editorial website (static).

## One-time setup (required before public SEO)

Edit `config.js`:

```js
siteUrl: "https://YOUR_REAL_USERNAME.github.io/KisanMentor",
basePath: "/KisanMentor",
```

For a custom domain at root:

```js
siteUrl: "https://www.yourdomain.com",
basePath: "",
```

Then enable **GitHub → Settings → Pages → Source: GitHub Actions**.

Until you set a real `siteUrl`, the build prints a warning. Canonical/sitemap URLs follow `config.js` only.

## Mobile publish flow

1. Add/edit `articles/{slug}.html` with `#article-data` JSON  
2. Commit to `main`  
3. GitHub Actions runs `npm run build` and deploys  

No local npm required on your phone.

## Local (optional)

```bash
npm run build
npm start
```

## Docs

- ARTICLE-SCHEMA.md  
- PUBLISHING-GUIDE.md  
- BLOGGING-FEATURES.md  
