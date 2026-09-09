# Article Schema

Single source of truth: JSON in each article file.

```html
<script type="application/json" id="article-data">
{ ... }
</script>
```

## Required
| Field | Type | Rules |
|-------|------|--------|
| slug | string | matches filename; `a-z0-9-` |
| title | string | min 10 chars |
| description | string | min 40 chars |
| type | string | from controlled list in config.js |
| category | string | from config categories |
| status | string | published \| draft \| archived |
| published | string | YYYY-MM-DD |

## Optional
subcategory, tags[], author, reviewer, modified, verified, image, imageAlt, featured, readingTime, related[], sources[], seoTitle, seoDescription, canonical, noindex

## AI generation
1. Unique slug = filename without .html  
2. Full HTML body with one H1  
3. Fill #article-data  
4. Save to articles/{slug}.html  
5. npm run build  

Invalid required data → build **fails**.


## Dates

Use calendar dates only: `YYYY-MM-DD`.

Display formatting must not apply timezone shifts.  
`2026-09-05` always displays as **5 सितंबर 2026**.

## Type safety

| Field | Required type |
|-------|----------------|
| tags, related, sources | array of strings |
| featured, noindex | boolean |
| readingTime | positive integer (optional) |

Invalid types → **build error**.
