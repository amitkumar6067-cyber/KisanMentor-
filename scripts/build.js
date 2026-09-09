#!/usr/bin/env node
/**
 * KisanMentor build — discover articles, validate, generate site surfaces
 */
const path = require("path");
const cfg = require("../config");
const {
  escapeHtml, escapeAttr, escapeXml, parseDate, dateSortKey, formatDateHi,
  estimateReadingTime, absoluteUrl, publicPath, relHref, ensureDir, readFile, writeFile, listHtmlFiles,
} = require("./utils");
const { validateArticle, validateInternalLinks } = require("./validators");

const ROOT = path.join(__dirname, "..");
const ARTICLES = path.join(ROOT, "articles");
const GENERATED = path.join(ROOT, "data", "generated");
const CATEGORIES_DIR = path.join(ROOT, "categories");

const R = "\x1b[31m", Y = "\x1b[33m", G = "\x1b[32m", C = "\x1b[36m", Z = "\x1b[0m";
const logErr = (m) => console.error(R + "ERROR:" + Z + " " + m);
const logWarn = (m) => console.warn(Y + "WARNING:" + Z + " " + m);
const logOk = (m) => console.log(G + "✓" + Z + " " + m);
const logInfo = (m) => console.log(C + "→" + Z + " " + m);

/** Public-safe article summary (no filesystem paths). */
function publicMeta(meta) {
  return {
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    type: meta.type,
    category: meta.category,
    subcategory: meta.subcategory || "",
    tags: meta.tags || [],
    author: meta.author || "",
    reviewer: meta.reviewer || "",
    published: meta.publishDate,
    modified: meta.modifiedDate || meta.publishDate,
    verified: meta.verified || "",
    image: meta.image || "",
    imageAlt: meta.imageAlt || "",
    featured: !!meta.featured,
    status: meta.status,
    related: meta.related || [],
    sources: meta.sources || [],
    noindex: !!meta.noindex,
    readingTime: meta.readingTime,
    url: "articles/" + meta.slug + ".html",
  };
}

function discover() {
  const files = listHtmlFiles(ARTICLES);
  const articles = [];
  const allSlugs = new Map();
  let fail = false;
  logInfo("Scanning " + files.length + " article file(s)");
  files.forEach((filePath) => {
    const html = readFile(filePath);
    const { errors, warnings, meta } = validateArticle(filePath, html, cfg, allSlugs);
    if (meta.slug) allSlugs.set(meta.slug, filePath);
    errors.forEach((e) => { logErr(path.relative(ROOT, filePath) + "\n       " + e); fail = true; });
    warnings.forEach((w) => logWarn(path.relative(ROOT, filePath) + "\n         " + w));
    const readingTime = meta.readingTime || estimateReadingTime(html);
    articles.push({ html, meta: Object.assign({}, meta, { readingTime }), errors, warnings });
  });
  validateInternalLinks(articles).forEach((e) => { logErr(e); fail = true; });
  if (fail) {
    console.error("\n" + R + "Build failed." + Z + "\n");
    process.exit(1);
  }
  return articles;
}

function publishedOnly(articles) {
  return articles
    .filter((a) => a.meta.status === "published" && !a.meta.noindex)
    .sort((a, b) => (dateSortKey(b.meta.publishDate) > dateSortKey(a.meta.publishDate) ? 1 : -1));
}

function articleCanonical(meta) {
  if (meta.canonical) return meta.canonical;
  return absoluteUrl(cfg, "/articles/" + meta.slug + ".html");
}

function articlePageTitle(meta) {
  const t = meta.seoTitle || meta.title;
  return t.indexOf(cfg.siteName) >= 0 ? t : t + " | " + cfg.siteName;
}

function articleDescription(meta) {
  return meta.seoDescription || meta.description;
}

/** Inject/replace head SEO tags from #article-data without removing the JSON block. */
function applyArticleSeo(html, meta) {
  const title = articlePageTitle(meta);
  const desc = articleDescription(meta);
  const canonical = articleCanonical(meta);
  const robots = meta.noindex ? "noindex, follow" : "index, follow";
  const ogImage = meta.image
    ? (meta.image.indexOf("http") === 0 ? meta.image : absoluteUrl(cfg, meta.image))
    : "";

  let out = html;
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(out)) {
    out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(title) + "</title>");
  } else {
    out = out.replace(/<\/head>/i, "  <title>" + escapeHtml(title) + "</title>\n</head>");
  }

  function setMetaName(name, content) {
    const re = new RegExp("<meta\\s+name=[\"']" + name + "[\"']\\s+content=[\"'][^\"']*[\"']\\s*/?>", "i");
    const tag = '<meta name="' + name + '" content="' + escapeAttr(content) + '" />';
    if (re.test(out)) out = out.replace(re, tag);
    else out = out.replace(/<\/head>/i, "  " + tag + "\n</head>");
  }
  function setMetaProp(prop, content) {
    if (!content) return;
    const re = new RegExp("<meta\\s+property=[\"']" + prop + "[\"']\\s+content=[\"'][^\"']*[\"']\\s*/?>", "i");
    const tag = '<meta property="' + prop + '" content="' + escapeAttr(content) + '" />';
    if (re.test(out)) out = out.replace(re, tag);
    else out = out.replace(/<\/head>/i, "  " + tag + "\n</head>");
  }

  setMetaName("description", desc);
  setMetaName("robots", robots);
  setMetaProp("og:type", "article");
  setMetaProp("og:title", meta.seoTitle || meta.title);
  setMetaProp("og:description", desc);
  setMetaProp("og:url", canonical);
  setMetaProp("og:locale", cfg.locale || "hi_IN");
  setMetaProp("og:site_name", cfg.siteName);
  if (ogImage) setMetaProp("og:image", ogImage);
  setMetaProp("article:published_time", meta.publishDate);
  if (meta.modifiedDate) setMetaProp("article:modified_time", meta.modifiedDate);

  setMetaName("twitter:card", ogImage ? "summary_large_image" : "summary");
  setMetaName("twitter:title", meta.seoTitle || meta.title);
  setMetaName("twitter:description", desc);
  if (ogImage) setMetaName("twitter:image", ogImage);

  const canRe = /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i;
  const canTag = '<link rel="canonical" href="' + escapeAttr(canonical) + '" />';
  if (canRe.test(out)) out = out.replace(canRe, canTag);
  else out = out.replace(/<\/head>/i, "  " + canTag + "\n</head>");

  // Structured data Article — only factual fields
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: desc,
    datePublished: meta.publishDate,
    dateModified: meta.modifiedDate || meta.publishDate,
    inLanguage: cfg.language || "hi",
    author: { "@type": "Organization", name: meta.author || cfg.defaultAuthor },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
  if (ogImage) ld.image = ogImage;
  const ldScript =
    '<script type="application/ld+json">\n' + JSON.stringify(ld, null, 2) + "\n  </script>";
  if (/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/i.test(out)) {
    out = out.replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/i, ldScript);
  } else {
    out = out.replace(/<\/head>/i, "  " + ldScript + "\n</head>");
  }

  // Visible date strings if present as meta lines — light touch: skip
  return out;
}

function writeArticlesWithSeo(list) {
  list.forEach((a) => {
    // Only rewrite published public articles; drafts left as-authored
    if (a.meta.status !== "published") return;
    const next = applyArticleSeo(a.html, a.meta);
    writeFile(a.meta.filePath, next);
  });
  logOk("Article SEO head updated from #article-data");
}

function writeSearchIndex(list) {
  const index = list.map((a) => ({
    title: a.meta.title,
    slug: a.meta.slug,
    url: "articles/" + a.meta.slug + ".html",
    category: a.meta.category,
    type: a.meta.type,
    excerpt: a.meta.description.slice(0, 160),
    tags: a.meta.tags,
    date: a.meta.publishDate,
  }));
  writeFile(path.join(GENERATED, "search-index.json"), JSON.stringify(index, null, 2));
  writeFile(path.join(GENERATED, "articles.json"), JSON.stringify(list.map((a) => publicMeta(a.meta)), null, 2));
  logOk("Search index (" + index.length + " articles)");
}

function writeSitemap(list) {
  const urls = [];
  urls.push({ loc: absoluteUrl(cfg, "/"), lastmod: null, priority: "1.0" });
  cfg.categories.forEach((cat) => {
    const items = list.filter((a) => a.meta.category === cat.slug);
    let lastmod = null;
    items.forEach((a) => {
      const d = a.meta.modifiedDate || a.meta.publishDate;
      if (d && (!lastmod || d > lastmod)) lastmod = d;
    });
    urls.push({
      loc: absoluteUrl(cfg, "/categories/" + cat.slug + ".html"),
      lastmod: lastmod,
      priority: "0.7",
    });
  });
  list.forEach((a) => {
    urls.push({
      loc: absoluteUrl(cfg, "/articles/" + a.meta.slug + ".html"),
      lastmod: a.meta.modifiedDate || a.meta.publishDate,
      priority: a.meta.featured ? "0.9" : "0.8",
    });
  });
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  urls.forEach((u) => {
    xml += "  <url>\n    <loc>" + escapeXml(u.loc) + "</loc>\n";
    if (u.lastmod) xml += "    <lastmod>" + escapeXml(u.lastmod) + "</lastmod>\n";
    if (u.priority) xml += "    <priority>" + u.priority + "</priority>\n";
    xml += "  </url>\n";
  });
  xml += "</urlset>\n";
  writeFile(path.join(ROOT, "sitemap.xml"), xml);
  logOk("sitemap.xml (" + urls.length + " URLs)");
}

function writeRobots() {
  const content =
    "User-agent: *\nAllow: /\nDisallow: /data/\nDisallow: /scripts/\nDisallow: /search.html\n\nSitemap: " +
    absoluteUrl(cfg, "/sitemap.xml") +
    "\n";
  writeFile(path.join(ROOT, "robots.txt"), content);
  logOk("robots.txt");
}

function headerHtml(depth) {
  depth = depth || 0;
  const home = relHref(depth, "index.html");
  const search = relHref(depth, "search.html");
  const about = relHref(depth, "about.html");
  const contact = relHref(depth, "contact.html");
  const catDesktop = cfg.categories
    .slice(0, 5)
    .map((c) => '<a href="' + relHref(depth, "categories/" + c.slug + ".html") + '">' + escapeHtml(c.name) + "</a>")
    .join("");
  const catMobile = cfg.categories
    .map((c) => '<a href="' + relHref(depth, "categories/" + c.slug + ".html") + '">' + escapeHtml(c.name) + "</a>")
    .join("");
  const desktop =
    '<a href="' + home + '">होम</a>' +
    catDesktop +
    '<a href="' + search + '">खोज</a>' +
    '<a href="' + about + '">परिचय</a>';
  const mobile =
    '<a href="' + home + '">होम</a>' +
    catMobile +
    '<a href="' + search + '">खोज</a>' +
    '<a href="' + about + '">परिचय</a>' +
    '<a href="' + contact + '">संपर्क</a>';
  return (
    '<header class="site-header"><div class="container header-inner">' +
    '<a class="logo" href="' + home + '"><span class="logo-mark">🌱</span><span class="logo-text"><strong>' +
    escapeHtml(cfg.siteName) + "</strong><small>" + escapeHtml(cfg.tagline) + "</small></span></a>" +
    '<nav class="nav-desktop" aria-label="मुख्य नेविगेशन">' + desktop + "</nav>" +
    '<button type="button" class="menu-toggle" aria-label="मेनू खोलें" aria-expanded="false" aria-controls="mobile-nav">☰</button>' +
    '</div><nav id="mobile-nav" class="nav-mobile" hidden aria-label="मोबाइल नेविगेशन">' + mobile + "</nav></header>"
  );
}

function footerHtml(depth) {
  depth = depth || 0;
  return (
    '<footer class="site-footer"><div class="container footer-inner">' +
    "<p><strong>" + escapeHtml(cfg.siteName) + "</strong> — " + escapeHtml(cfg.tagline) + "</p>" +
    "<p>" +
    '<a href="' + relHref(depth, "about.html") + '">परिचय</a> · ' +
    '<a href="' + relHref(depth, "contact.html") + '">संपर्क</a> · ' +
    '<a href="' + relHref(depth, "privacy.html") + '">गोपनीयता</a> · ' +
    '<a href="' + relHref(depth, "disclaimer.html") + '">अस्वीकरण</a> · ' +
    '<a href="' + relHref(depth, "terms.html") + '">शर्तें</a>' +
    "</p><p class=\"copy\">© " + new Date().getFullYear() + " " + escapeHtml(cfg.siteName) + "</p>" +
    "</div></footer>"
  );
}


function writeCategoryPages(list) {
  ensureDir(CATEGORIES_DIR);
  cfg.categories.forEach((cat) => {
    const items = list.filter((a) => a.meta.category === cat.slug);
    const countLabel = items.length === 0 ? "अभी कोई लेख नहीं" : items.length + " लेख";
    let cards = "";
    if (!items.length) {
      cards = '<p class="empty-state">इस श्रेणी में अभी प्रकाशित लेख नहीं है।</p>';
    } else {
      cards = items
        .map((a) => {
          const url = relHref(1, "articles/" + a.meta.slug + ".html");
          return (
            '<article class="card">' +
            "<h3><a href=\"" + escapeAttr(url) + "\">" + escapeHtml(a.meta.title) + "</a></h3>" +
            "<p>" + escapeHtml(a.meta.description.slice(0, 140)) + "…</p>" +
            '<p class="meta">' + escapeHtml(formatDateHi(a.meta.publishDate)) +
            " · " + a.meta.readingTime + " मिनट</p></article>"
          );
        })
        .join("\n");
    }
    const canonical = absoluteUrl(cfg, "/categories/" + cat.slug + ".html");
    const html =
      "<!DOCTYPE html>\n<html lang=\"hi\">\n<head>\n<meta charset=\"UTF-8\"/>\n" +
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
      "<title>" + escapeHtml(cat.name + " | " + cfg.siteName) + "</title>\n" +
      '<meta name="description" content="' + escapeAttr(cat.description) + '"/>\n' +
      '<link rel="canonical" href="' + escapeAttr(canonical) + '"/>\n' +
      '<meta name="robots" content="index, follow"/>\n' +
      '<link rel="stylesheet" href="' + relHref(1, "assets/css/style.css") + '"/>\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n' +
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet"/>\n</head>\n<body>\n' +
      '<a class="skip-link" href="#main">मुख्य सामग्री</a>\n' +
      headerHtml(1) +
      '<main id="main" class="container page">\n' +
      '<nav class="breadcrumb"><a href="' + relHref(1, "index.html") + '">होम</a> › ' +
      escapeHtml(cat.name) + "</nav>\n" +
      "<h1>" + escapeHtml(cat.name) + "</h1>\n" +
      '<p class="lead">' + escapeHtml(cat.description) + "</p>\n" +
      '<p class="meta">' + escapeHtml(countLabel) + "</p>\n" +
      '<div class="card-list">' + cards + "</div>\n</main>\n" +
      footerHtml(1) +
      '<script src="' + relHref(1, "assets/js/main.js") + '"></script>\n</body>\n</html>\n';
    writeFile(path.join(CATEGORIES_DIR, cat.slug + ".html"), html);
  });
  logOk("Category pages (" + cfg.categories.length + ")");
}

function writeHomepage(list) {
  const featured = list.filter((a) => a.meta.featured);
  const latest = list.slice(0, 10);
  const showFeatured = featured.length > 0;
  const picks = showFeatured ? featured.slice(0, 3) : latest.slice(0, 3);

  function cards(items) {
    if (!items.length) return '<p class="empty-state">अभी कोई प्रकाशित लेख नहीं है।</p>';
    return items
      .map((a) => {
        const url = relHref(0, "articles/" + a.meta.slug + ".html");
        return (
          '<article class="card">' +
          "<h3><a href=\"" + escapeAttr(url) + "\">" + escapeHtml(a.meta.title) + "</a></h3>" +
          "<p>" + escapeHtml(a.meta.description.slice(0, 140)) + "…</p>" +
          '<p class="meta">' + escapeHtml(formatDateHi(a.meta.publishDate)) +
          " · " + escapeHtml(a.meta.category) + "</p></article>"
        );
      })
      .join("\n");
  }

  const catGrid = cfg.categories
    .map(
      (c) =>
        '<a class="cat-card" href="' +
        relHref(0, "categories/" + c.slug + ".html") +
        '"><strong>' +
        escapeHtml(c.name) +
        "</strong><span>" +
        escapeHtml(c.description) +
        "</span></a>"
    )
    .join("\n");

  const homeCanonical = absoluteUrl(cfg, "/");
  const html =
    "<!DOCTYPE html>\n<html lang=\"hi\">\n<head>\n" +
    '<meta charset="UTF-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
    "<title>" + escapeHtml(cfg.siteName + " — " + cfg.tagline) + "</title>\n" +
    '<meta name="description" content="' + escapeAttr(cfg.description) + '"/>\n' +
    '<link rel="canonical" href="' + escapeAttr(homeCanonical) + '"/>\n' +
    '<meta name="robots" content="index, follow"/>\n' +
    '<meta property="og:type" content="website"/>\n' +
    '<meta property="og:title" content="' + escapeAttr(cfg.siteName) + '"/>\n' +
    '<meta property="og:description" content="' + escapeAttr(cfg.description) + '"/>\n' +
    '<meta property="og:url" content="' + escapeAttr(homeCanonical) + '"/>\n' +
    '<meta property="og:locale" content="' + escapeAttr(cfg.locale || "hi_IN") + '"/>\n' +
    '<link rel="stylesheet" href="' + relHref(0, "assets/css/style.css") + '"/>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet"/>\n' +
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: cfg.siteName,
      url: homeCanonical,
      inLanguage: cfg.language || "hi",
      potentialAction: {
        "@type": "SearchAction",
        target: absoluteUrl(cfg, "/search.html") + "?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    }) +
    "</script>\n</head>\n<body>\n" +
    '<a class="skip-link" href="#main">मुख्य सामग्री</a>\n' +
    headerHtml(0) +
    '<section class="hero"><div class="container">' +
    "<h1>खेती और कृषि ज्ञान — साफ, सरल, उपयोगी</h1>" +
    "<p>" + escapeHtml(cfg.description) + "</p>" +
    '<div class="actions">' +
    '<a class="btn btn-primary" href="#latest">नए लेख पढ़ें</a>' +
    '<a class="btn btn-ghost" href="' + relHref(0, "search.html") + '">खोजें</a>' +
    "</div></div></section>\n" +
    '<main id="main" class="container">' +
    '<section class="section"><h2>विषय चुनें</h2><div class="cat-grid">' +
    catGrid +
    "</div></section>\n" +
    (picks.length
      ? '<section class="section"><h2>' +
        (showFeatured ? "Editor's Picks" : "चुनिंदा लेख") +
        "</h2><div class=\"card-list\">" +
        cards(picks) +
        "</div></section>\n"
      : "") +
    '<section class="section" id="latest"><h2>नवीनतम ज्ञान</h2><div class="card-list">' +
    cards(latest) +
    "</div></section>\n" +
    "</main>\n" +
    footerHtml(0) +
    '<script src="' + relHref(0, "assets/js/main.js") + '"></script>\n</body>\n</html>\n';

  writeFile(path.join(ROOT, "index.html"), html);
  writeFile(
    path.join(GENERATED, "homepage.json"),
    JSON.stringify(
      {
        featured: featured.map((a) => publicMeta(a.meta)),
        latest: latest.map((a) => publicMeta(a.meta)),
        categories: cfg.categories,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  logOk("index.html + homepage.json (from published articles)");
}


function writeStaticShell(opts) {
  const {
    filename,
    title,
    description,
    robots = "index, follow",
    pathSeg,
    body,
    extraHead = "",
    extraBodyEnd = "",
  } = opts;
  const canonical = absoluteUrl(cfg, pathSeg);
  const html =
    "<!DOCTYPE html>\n<html lang=\"hi\">\n<head>\n" +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
    "<title>" + escapeHtml(title) + "</title>\n" +
    (description
      ? '<meta name="description" content="' + escapeAttr(description) + '"/>\n'
      : "") +
    '<meta name="robots" content="' + escapeAttr(robots) + '"/>\n' +
    '<link rel="canonical" href="' + escapeAttr(canonical) + '"/>\n' +
    '<link rel="stylesheet" href="' + relHref(0, "assets/css/style.css") + '"/>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet"/>\n' +
    extraHead +
    "</head>\n<body>\n" +
    '<a class="skip-link" href="#main">मुख्य सामग्री</a>\n' +
    headerHtml(0) +
    '<main id="main" class="container page" style="max-width:42rem">' +
    body +
    "</main>\n" +
    footerHtml(0) +
    '<script src="' + relHref(0, "assets/js/main.js") + '"></script>\n' +
    extraBodyEnd +
    "</body>\n</html>\n";
  writeFile(path.join(ROOT, filename), html);
}

function writeStaticPages() {
  writeStaticShell({
    filename: "about.html",
    title: "परिचय | " + cfg.siteName,
    description: cfg.siteName + " — किसानों और कृषि छात्रों के लिए ज्ञान मंच।",
    pathSeg: "/about.html",
    body:
      "<h1>परिचय</h1>" +
      "<p><strong>" + escapeHtml(cfg.siteName) + "</strong> किसानों और कृषि छात्रों के लिए कृषि ज्ञान का साफ डिजिटल मंच है। फोकस उपयोगी लेख, स्पष्ट श्रेणियाँ और आसान खोज पर है।</p>" +
      "<p>सामग्री सामान्य जानकारी के लिए है। योजनाओं या खेत-स्तरीय निर्णयों के लिए आधिकारिक स्रोत और स्थानीय विशेषज्ञ देखें।</p>" +
      "<p><a href=\"" + relHref(0, "disclaimer.html") + "\">अस्वीकरण</a> · <a href=\"" + relHref(0, "contact.html") + "\">संपर्क</a></p>",
  });

  let contactBody =
    "<h1>संपर्क</h1>" +
    "<p>सुझाव या सुधार के लिए GitHub repository के Issues का उपयोग करें, जहाँ यह प्रोजेक्ट होस्ट है।</p>";
  if (cfg.contactEmail) {
    contactBody +=
      "<p>ईमेल: <a href=\"mailto:" +
      escapeAttr(cfg.contactEmail) +
      "\">" +
      escapeHtml(cfg.contactEmail) +
      "</a></p>";
  } else {
    contactBody +=
      '<p class="meta">सार्वजनिक ईमेल अभी कॉन्फ़िग में सेट नहीं है। लाइव संपर्क फॉर्म सक्रिय नहीं है।</p>';
  }
  writeStaticShell({
    filename: "contact.html",
    title: "संपर्क | " + cfg.siteName,
    description: cfg.siteName + " से संपर्क कैसे करें।",
    pathSeg: "/contact.html",
    body: contactBody,
  });

  writeStaticShell({
    filename: "privacy.html",
    title: "गोपनीयता नीति | " + cfg.siteName,
    description: cfg.siteName + " गोपनीयता नीति।",
    pathSeg: "/privacy.html",
    body:
      "<h1>गोपनीयता नीति</h1>" +
      "<p><strong>" + escapeHtml(cfg.siteName) + "</strong> मुख्य रूप से एक स्थैतिक कृषि ज्ञान वेबसाइट है। उपयोगकर्ता खाते नहीं बनाए जाते।</p>" +
      "<h2>डेटा</h2><p>साइट स्वयं कोई व्यक्तिगत प्रोफ़ाइल डेटाबेस नहीं रखती। लेख पढ़ने के लिए पंजीकरण आवश्यक नहीं है।</p>" +
      "<h2>होस्टिंग</h2><p>होस्ट (जैसे GitHub Pages) सामान्य सर्वर लॉग रख सकता है। यह होस्ट की नीतियों के अधीन है।</p>" +
      "<h2>कुकीज़ और विज्ञापन</h2><p>वर्तमान में विज्ञापन सक्रिय नहीं हैं। भविष्य में यदि तृतीय-पक्ष विज्ञापन जोड़ा जाए, नीति अपडेट की जाएगी।</p>" +
      "<h2>संपर्क</h2><p><a href=\"" + relHref(0, "contact.html") + "\">संपर्क पृष्ठ</a> देखें।</p>" +
      '<p class="meta">अंतिम अद्यतन: 2026</p>',
  });

  writeStaticShell({
    filename: "disclaimer.html",
    title: "अस्वीकरण | " + cfg.siteName,
    description: cfg.siteName + " सामग्री अस्वीकरण।",
    pathSeg: "/disclaimer.html",
    body:
      "<h1>अस्वीकरण</h1>" +
      "<p>सामग्री <strong>शैक्षिक और सूचनात्मक</strong> है। यह व्यक्तिगत सलाह या सरकारी योजना की आधिकारिक घोषणा नहीं है।</p>" +
      "<ul style=\"margin:1em 0 1em 1.2em\">" +
      "<li>खेती के निर्णय स्थानीय परिस्थितियों पर निर्भर करते हैं।</li>" +
      "<li>सरकारी योजनाएँ बदल सकती हैं — आधिकारिक स्रोत जाँचें।</li>" +
      "<li>उत्पादन या आय की कोई गारंटी नहीं।</li>" +
      "</ul>" +
      "<p>संदेह पर कृषि विभाग या योग्य विशेषज्ञ से सलाह लें।</p>",
  });

  writeStaticShell({
    filename: "terms.html",
    title: "उपयोग की शर्तें | " + cfg.siteName,
    description: cfg.siteName + " उपयोग की शर्तें।",
    pathSeg: "/terms.html",
    body:
      "<h1>उपयोग की शर्तें</h1>" +
      "<p>सामग्री व्यक्तिगत अध्ययन के लिए “जैसी है” आधार पर उपलब्ध है।</p>" +
      "<ul style=\"margin:1em 0 1em 1.2em\">" +
      "<li>व्यावसायिक पुनर्प्रकाशन बिना अनुमति न करें।</li>" +
      "<li>सेवा रुकावट या त्रुटि के लिए दायित्व स्वीकार नहीं किया जाता।</li>" +
      "<li><a href=\"" + relHref(0, "disclaimer.html") + "\">अस्वीकरण</a> और <a href=\"" + relHref(0, "privacy.html") + "\">गोपनीयता</a> लागू होते हैं।</li>" +
      "</ul>",
  });

  writeStaticShell({
    filename: "404.html",
    title: "पृष्ठ नहीं मिला | " + cfg.siteName,
    description: "",
    robots: "noindex, follow",
    pathSeg: "/404.html",
    body:
      "<h1>पृष्ठ नहीं मिला</h1>" +
      "<p>यह पता मौजूद नहीं है या हटा दिया गया है।</p>" +
      "<p style=\"margin-top:16px\">" +
      '<a class="btn btn-outline" href="' + relHref(0, "index.html") + '">होम</a> ' +
      '<a class="btn btn-outline" href="' + relHref(0, "search.html") + '">खोज</a></p>',
  });

  // Search page with same chrome
  const searchBody =
    "<h1>खोजें</h1>" +
    '<form class="search-box" id="sf" role="search">' +
    '<label class="visually-hidden" for="q">खोज</label>' +
    '<input type="search" id="q" name="q" placeholder="जैसे: धान, मिट्टी, योजना…" autocomplete="off"/>' +
    '<button type="submit">खोज</button></form>' +
    '<div id="results" aria-live="polite"></div>';

  const searchJs =
    "<script>\n" +
    "(function(){\n" +
    "  var index=[], results=document.getElementById('results'), input=document.getElementById('q');\n" +
    "  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}\n" +
    "  var indexUrl = '" + relHref(0, "data/generated/search-index.json") + "';\n" +
    "  fetch(indexUrl).then(function(r){return r.json();}).then(function(d){\n" +
    "    index=d||[];\n" +
    "    var p=new URLSearchParams(location.search);\n" +
    "    if(p.get('q')){input.value=p.get('q'); run(p.get('q'));}\n" +
    "  }).catch(function(){\n" +
    "    results.innerHTML='<p class=\"empty-state\">खोज सूची उपलब्ध नहीं। बिल्ड के बाद पुनः प्रयास करें।</p>';\n" +
    "  });\n" +
    "  function run(q){\n" +
    "    q=(q||'').trim().toLowerCase();\n" +
    "    if(!q){results.innerHTML='';return;}\n" +
    "    var hits=index.filter(function(a){\n" +
    "      return [a.title,a.excerpt,(a.tags||[]).join(' '),a.category,a.type].join(' ').toLowerCase().indexOf(q)>=0;\n" +
    "    }).slice(0,25);\n" +
    "    if(!hits.length){results.innerHTML='<p class=\"empty-state\">इस विषय से संबंधित लेख अभी नहीं मिला।</p>';return;}\n" +
    "    results.innerHTML=hits.map(function(a){\n" +
    "      return '<article class=\"card\"><h3><a href=\"'+esc(a.url)+'\">'+esc(a.title)+'</a></h3><p>'+esc(a.excerpt)+'</p><p class=\"meta\">'+esc(a.category)+' · '+esc(a.date)+'</p></article>';\n" +
    "    }).join('');\n" +
    "  }\n" +
    "  document.getElementById('sf').addEventListener('submit',function(e){e.preventDefault();run(input.value); history.replaceState(null,'','?q='+encodeURIComponent(input.value.trim()));});\n" +
    "  input.addEventListener('input',function(){run(input.value);});\n" +
    "})();\n" +
    "</script>\n";

  writeStaticShell({
    filename: "search.html",
    title: "खोज | " + cfg.siteName,
    description: cfg.siteName + " पर लेख खोजें।",
    robots: "noindex, follow",
    pathSeg: "/search.html",
    body: searchBody,
    extraBodyEnd: searchJs,
  });

  logOk("Static pages (about, contact, legal, 404, search) with shared nav");
}


function writeManifest(list) {
  writeFile(
    path.join(GENERATED, "build-manifest.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        siteUrl: cfg.siteUrl,
        basePath: cfg.basePath,
        articleCount: list.length,
        articles: list.map((a) => ({
          slug: a.meta.slug,
          title: a.meta.title,
          category: a.meta.category,
          type: a.meta.type,
          published: a.meta.publishDate,
          featured: a.meta.featured,
        })),
      },
      null,
      2
    )
  );
  logOk("build-manifest.json");
}

function main() {
  console.log("\n" + C + "══ KisanMentor Build ══" + Z + "\n");
  logInfo("siteUrl: " + cfg.siteUrl);
  if (!cfg.siteUrl || /YOUR_GITHUB_USERNAME|example\.github\.io/i.test(cfg.siteUrl)) {
    logWarn("config.siteUrl still uses a placeholder — set your real GitHub Pages URL before public SEO.");
  }
  logInfo("basePath: " + JSON.stringify(cfg.basePath));
  ensureDir(GENERATED);
  const articles = discover();
  const list = publishedOnly(articles);
  logInfo("Published: " + list.length);
  writeArticlesWithSeo(list);
  writeSearchIndex(list);
  writeSitemap(list);
  writeRobots();
  writeCategoryPages(list);
  writeHomepage(list);
  writeStaticPages();
  writeManifest(list);
  console.log("\n" + G + "Build completed successfully." + Z + "\n");
}

main();
