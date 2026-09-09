const path = require("path");
const {
  isValidSlug, parseDate, extractArticleData, extractH1,
  extractInternalArticleLinks, asStringArray,
} = require("./utils");

function validateArticle(filePath, html, cfg, allSlugs) {
  const errors = [];
  const warnings = [];
  const fileName = path.basename(filePath);
  const fileStem = fileName.replace(/\.html$/i, "");

  const extracted = extractArticleData(html);
  if (extracted.error) {
    errors.push(extracted.error);
    return { errors, warnings, meta: { filePath, fileName, slug: "", status: "draft" } };
  }

  const d = extracted.data;
  const slug = d.slug != null ? String(d.slug).trim() : "";
  const title = d.title != null ? String(d.title).trim() : "";
  const description = d.description != null ? String(d.description).trim() : "";
  const type = d.type != null ? String(d.type).trim() : "";
  const category = d.category != null ? String(d.category).trim() : "";
  const status = d.status != null ? String(d.status).trim().toLowerCase() : "";
  const published = d.published != null ? String(d.published).trim() : "";
  const modified = d.modified != null ? String(d.modified).trim() : "";
  const verified = d.verified != null ? String(d.verified).trim() : "";
  const author = d.author != null ? String(d.author).trim() : cfg.defaultAuthor;
  const reviewer = d.reviewer != null ? String(d.reviewer).trim() : "";
  const image = d.image != null ? String(d.image).trim() : "";
  const imageAlt = d.imageAlt != null ? String(d.imageAlt).trim() : "";
  const tags = asStringArray(d.tags);
  const related = asStringArray(d.related);
  const sources = asStringArray(d.sources);
  const featured = d.featured === true;
  const noindex = d.noindex === true;
  const subcategory = d.subcategory != null ? String(d.subcategory).trim() : "";
  const h1 = extractH1(html);

  if (!slug) errors.push("Missing required field: slug");
  else if (!isValidSlug(slug)) errors.push('Invalid slug "' + slug + '"');
  else if (slug !== fileStem) errors.push('slug must match filename stem "' + fileStem + '"');
  else if (allSlugs.has(slug) && allSlugs.get(slug) !== filePath) {
    errors.push('Duplicate slug "' + slug + '"');
  }

  if (!title || title.length < 10) errors.push("Missing or too short title");
  if (!description || description.length < 40) errors.push("Missing or too short description");
  if (!type) errors.push("Missing required field: type");
  else if (cfg.types.indexOf(type) === -1) errors.push('Invalid type "' + type + '"');
  if (!category) errors.push("Missing required field: category");
  else if (!cfg.categories.some((c) => c.slug === category)) errors.push('Invalid category "' + category + '"');
  if (!status) errors.push("Missing required field: status");
  else if (cfg.statuses.indexOf(status) === -1) errors.push('Invalid status "' + status + '"');
  if (!published) errors.push("Missing required field: published");
  else if (!parseDate(published)) errors.push("Invalid published date — use YYYY-MM-DD");
  if (modified && !parseDate(modified)) errors.push("Invalid modified date");
  if (verified && !parseDate(verified)) errors.push("Invalid verified date");
  if (!h1) errors.push("Missing H1 in article body");

  if (!modified) warnings.push("Missing modified date");
  if (!tags.length) warnings.push("No tags");
  if (!image) warnings.push("No featured image");
  else if (!imageAlt) warnings.push("image without imageAlt");
  if (image && /^https?:\/\//i.test(image) && image.indexOf(cfg.siteUrl) !== 0) {
    warnings.push("External image URL — prefer /assets/images/");
  }
  const pub = parseDate(published);
  if (pub && pub > new Date()) warnings.push("published date is in the future");
  if (noindex) warnings.push("noindex=true");

  if (d.readingTime != null && d.readingTime !== "") {
    if (typeof d.readingTime !== "number" || !(d.readingTime > 0) || Math.floor(d.readingTime) !== d.readingTime) {
      errors.push("readingTime must be a positive integer when provided");
    }
  }
  if (d.featured != null && typeof d.featured !== "boolean") {
    errors.push("featured must be a boolean when provided");
  }
  if (d.noindex != null && typeof d.noindex !== "boolean") {
    errors.push("noindex must be a boolean when provided");
  }
  if (d.tags != null && !Array.isArray(d.tags)) errors.push("tags must be an array when provided");
  if (d.related != null && !Array.isArray(d.related)) errors.push("related must be an array when provided");
  if (d.sources != null && !Array.isArray(d.sources)) errors.push("sources must be an array when provided");

  const meta = {
    filePath, fileName, slug, title, description, type, category, subcategory,
    tags, author, reviewer, publishDate: published, modifiedDate: modified || published,
    verified, image, imageAlt, featured, status, related, sources, noindex,
    seoTitle: d.seoTitle ? String(d.seoTitle).trim() : "",
    seoDescription: d.seoDescription ? String(d.seoDescription).trim() : "",
    canonical: d.canonical ? String(d.canonical).trim() : "",
    readingTime: typeof d.readingTime === "number" ? d.readingTime : null,
    h1,
  };
  return { errors, warnings, meta };
}

function validateInternalLinks(articles) {
  const errors = [];
  const published = new Set(
    articles.filter((a) => a.meta.status === "published" && !a.meta.noindex).map((a) => a.meta.slug)
  );
  articles.forEach((article) => {
    if (article.meta.status !== "published") return;
    (article.meta.related || []).forEach((rel) => {
      if (rel === article.meta.slug) errors.push(article.meta.fileName + ": related cannot include self");
      else if (!published.has(rel)) errors.push(article.meta.fileName + ': related "' + rel + '" missing or not published');
    });
    extractInternalArticleLinks(article.html).forEach((href) => {
      const m = /(?:^|\/)([^/]+)\.html$/.exec(href);
      if (!m) return;
      const t = m[1];
      if (t === article.meta.slug) errors.push(article.meta.fileName + ": self-link in body");
      else if (!published.has(t)) errors.push(article.meta.fileName + ': link to missing article "' + t + '"');
    });
  });
  return errors;
}

module.exports = { validateArticle, validateInternalLinks };
