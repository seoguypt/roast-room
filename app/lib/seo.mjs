import { load } from "cheerio";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import { SEO_DISCLAIMER } from "./seo-seats.mjs";
export { SEO_SEATS, SEO_RULES, SEO_DISCLAIMER, seoSystem } from "./seo-seats.mjs";

export function normalizeWebsite(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.length > 2048) throw new Error("Enter a website URL, such as https://example.com.");
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); }
  catch { throw new Error("Enter a valid website URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Use a public HTTP or HTTPS website URL without credentials or custom ports.");
  url.hash = "";
  return url;
}

export function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  // Public global-unicast IPv6 only; exclude mapped IPv4, local ranges and documentation space.
  if (net.isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0|10|20):/i.test(address);
  return false;
}

export async function publicTarget(url) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Only public websites can be inspected; private and local addresses are blocked.");
  return addresses[0];
}

export async function fetchPublic(input, redirects = 0) {
  const url = normalizeWebsite(input);
  const target = await publicTarget(url);
  const result = await new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.get(url, {
      headers: { "user-agent": "RoastRoomSEO/1.0", accept: "text/html,application/xhtml+xml,text/plain,application/xml,text/xml" },
      lookup: (_host, options, callback) => callback(null, options.all ? [target] : target.address, target.family),
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume(); resolve({ redirect: new URL(res.headers.location, url).href }); return;
      }
      const chunks = []; let bytes = 0;
      res.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > 2_000_000) req.destroy(new Error("Page exceeds the 2 MB inspection limit."));
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({ url: url.href, status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new Error("Website inspection timed out.")), 12000);
    req.on("close", () => clearTimeout(timer)); req.on("error", reject);
  });
  if (result.redirect) {
    if (redirects >= 4) throw new Error("Website redirected too many times.");
    const final = await fetchPublic(result.redirect, redirects + 1);
    return {...final,redirectChain:[{from:url.href,to:result.redirect},...(final.redirectChain||[])]};
  }
  return {...result,redirectChain:[]};
}

export function extractPage(result) {
  const $ = load(result.body);
  const links = $("a[href]").map((_i, el) => {
    try { const u = new URL($(el).attr("href"), result.url); u.hash = ""; return ["http:", "https:"].includes(u.protocol) ? { url: u.href, text: $(el).text().trim().slice(0, 100) } : null; } catch { return null; }
  }).get().filter(Boolean);
  const jsonLd = $('script[type="application/ld+json"]').map((_i, el) => {
    try { const j = JSON.parse($(el).text()); const types = []; const walk = v => { if (!v || typeof v !== "object") return; if (v["@type"]) types.push(v["@type"]); for (const x of Object.values(v)) if (x && typeof x === "object") Array.isArray(x) ? x.forEach(walk) : walk(x); }; walk(j); return { validJson: true, types: types.flat().slice(0, 20) }; }
    catch { return { validJson: false, types: [] }; }
  }).get();
  const images = $("img");
  const headings = $("h1,h2,h3").map((_i, el) => ({ level: el.tagName, text: $(el).text().trim().slice(0, 180) })).get();
  $("script,style,noscript,svg").remove();
  const primary = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  const text = primary.text().replace(/\s+/g, " ").trim();
  return { textSource: primary.is("main") ? "main" : primary.is("article") ? "article" : "body", viewport: $('meta[name="viewport" i]').attr("content") || "", authorMarkers: $('[rel="author"], [itemprop="author"], .author, .byline').map((_i,el)=>$(el).text().trim().slice(0,180)).get().filter(Boolean).slice(0,5), url: result.url, status: result.status, title: $("title").text().trim().slice(0, 250), description: $('meta[name="description" i]').attr("content") || "", canonical: $('link[rel="canonical" i]').attr("href") || "", robotsMeta: $('meta[name="robots" i]').attr("content") || "", xRobotsTag: result.headers["x-robots-tag"] || "", lang: $("html").attr("lang") || "", headings: headings.slice(0, 35), h1Count: headings.filter(h => h.level === "h1").length, wordCount: text ? text.split(/\s+/).length : 0, textExcerpt: text.slice(0, 6000), imageCount: images.length, imagesWithoutAlt: images.filter((_i, el) => $(el).attr("alt") === undefined).length, jsonLd, internalLinks: links.filter(l => new URL(l.url).origin === new URL(result.url).origin).slice(0, 40), externalLinkCount: links.filter(l => new URL(l.url).origin !== new URL(result.url).origin).length };
}

// Conservative sample crawl: any matching Disallow prevents fetching a linked page.
export function allowsSample(robots, pathname) {
  return !robots.split(/\r?\n/).some(line => {
    const rule = line.replace(/#.*/, "").match(/^\s*Disallow\s*:\s*(\S+)/i)?.[1];
    if (!rule) return false;
    const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp("^" + escaped).test(pathname);
  });
}

export async function inspectWebsite(input, read = fetchPublic, onProgress = () => {}, { maxPages = 4 } = {}) {
  const target = normalizeWebsite(input);
  onProgress("Reading the submitted page");
  const main = await read(target.href);
  if (main.status < 200 || main.status >= 300 || !/text\/html|application\/xhtml\+xml/i.test(main.headers["content-type"] || "")) throw new Error(`Cannot inspect this page: HTTP ${main.status}, or not an HTML page.`);
  const first = extractPage(main);
  const origin = new URL(main.url).origin;
  const notes = [];
  async function resource(path) {
    try { const r = await read(origin + path); return { url: r.url, status: r.status, excerpt: r.body.slice(0, 4500), body: r.body }; }
    catch (e) { return { url: origin + path, error: e.message, body: "" }; }
  }
  onProgress("Checking robots.txt and sitemap.xml");
  const robots = await resource("/robots.txt");
  const sitemap = await resource("/sitemap.xml");
  const pages = [first];
  if (robots.status === 200 || robots.status === 404) {
    const seen = new Set([first.url]);
    for (const link of first.internalLinks) {
      if (pages.length >= maxPages) break;
      const url = new URL(link.url);
      if (seen.has(url.href) || url.search || /\.(?:pdf|zip|jpg|png|webp|mp4|xml)$/i.test(url.pathname) || !allowsSample(robots.status === 200 ? robots.body : "", url.pathname)) continue;
      seen.add(url.href);
      onProgress(`Sampling ${url.pathname}`);
      try { const r = await read(url.href); if (r.status === 200 && /text\/html/i.test(r.headers["content-type"] || "") && new URL(r.url).origin === origin) pages.push(extractPage(r)); }
      catch (e) { notes.push(`${url.href}: ${e.message}`); }
      if (seen.size >= 7) break;
    }
  } else notes.push("Linked pages were not sampled because robots.txt could not be checked.");
  const cleanResource = ({ body, ...rest }) => rest;
  return { submittedUrl: target.href, fetchedAt: new Date().toISOString(), pages, robots: cleanResource(robots), sitemap: cleanResource(sitemap), notes, limitations: SEO_DISCLAIMER };
}
