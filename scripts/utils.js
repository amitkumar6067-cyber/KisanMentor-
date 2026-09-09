const fs = require("fs");
const path = require("path");

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function escapeXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isValidSlug(slug) {
  return typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 120;
}

/** Validate YYYY-MM-DD; return the string if valid, else null (no timezone). */
function parseDate(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Reject impossible calendar days loosely via UTC noon check
  const probe = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return m[0]; // return canonical YYYY-MM-DD string
}

/** Sort key: YYYY-MM-DD sorts lexicographically as chronological. */
function dateSortKey(str) {
  return parseDate(str) || "";
}

/** Display Hindi date from YYYY-MM-DD without timezone shift. */
function formatDateHi(dateStr) {
  const s = typeof dateStr === "string" ? parseDate(dateStr) : null;
  if (!s) return "";
  const months = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
  const parts = s.split("-");
  const day = String(parseInt(parts[2], 10));
  const month = months[parseInt(parts[1], 10) - 1];
  const year = parts[0];
  return day + " " + month + " " + year;
}

function estimateReadingTime(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function extractArticleData(html) {
  const re = /<script[^>]*\bid\s*=\s*["']article-data["'][^>]*>([\s\S]*?)<\/script>/i;
  const m = re.exec(html);
  if (!m) return { data: null, error: 'Missing <script type="application/json" id="article-data">' };
  try {
    const data = JSON.parse(m[1].trim());
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { data: null, error: "#article-data must be a JSON object" };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Invalid JSON in #article-data: " + e.message };
  }
}

function extractH1(html) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractInternalArticleLinks(html) {
  const links = [];
  const re = /<a\s[^>]*href=["']([^"']*articles\/[^"']+\.html)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) links.push(match[1]);
  return Array.from(new Set(links));
}


/**
 * Relative href from a page at given depth (0 = site root, 1 = categories/ or articles/).
 * Keeps the site connected when opened locally or on GitHub Pages.
 */
function relHref(depth, target) {
  const t = String(target || "").replace(/^\/+/, "");
  if (!depth || depth < 1) return t;
  return "../".repeat(depth) + t;
}

function absoluteUrl(cfg, rel) {
  const base = cfg.siteUrl.replace(/\/$/, "");
  const p = rel.startsWith("/") ? rel : "/" + rel;
  if (cfg.basePath && base.endsWith(String(cfg.basePath).replace(/\/$/, ""))) return base + p;
  const bp = (cfg.basePath || "").replace(/\/$/, "");
  return base + bp + p;
}

function publicPath(cfg, rel) {
  const bp = (cfg.basePath || "").replace(/\/$/, "");
  const p = rel.startsWith("/") ? rel : "/" + rel;
  return bp + p;
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function readFile(f) {
  return fs.readFileSync(f, "utf8");
}

function writeFile(f, c) {
  ensureDir(path.dirname(f));
  fs.writeFileSync(f, c, "utf8");
}

function listHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => path.join(dir, f));
}

function asStringArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

module.exports = {
  escapeHtml, escapeAttr, escapeXml, isValidSlug, parseDate, dateSortKey, formatDateHi,
  estimateReadingTime, extractArticleData, extractH1, extractInternalArticleLinks,
  absoluteUrl, publicPath, relHref, ensureDir, readFile, writeFile, listHtmlFiles, asStringArray,
};
