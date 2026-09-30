import logger from '../utils/logger.js';

/**
 * Converts raw HTML into clean readable Markdown.
 * @param {string} html
 * @returns {string}
 */
export function htmlToMarkdown(html) {
  if (!html) return '';

  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  cleaned = cleaned
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n### $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n* $1')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, ' ');

  return cleaned
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Extracts links from HTML matching domain constraints.
 * @param {string} html
 * @param {string} baseUrlString
 * @param {boolean} sameDomainOnly
 * @returns {Array<string>}
 */
export function extractLinks(html, baseUrlString, sameDomainOnly = true) {
  if (!html) return [];
  const links = new Set();
  const baseUrl = new URL(baseUrlString);

  const regex = /<a\b[^>]*href=["']([^"']*)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:')) {
      continue;
    }

    try {
      const resolved = new URL(raw, baseUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) continue;
      if (sameDomainOnly && resolved.hostname !== baseUrl.hostname) continue;

      resolved.hash = '';
      links.add(resolved.toString());
    } catch {
      // Ignore malformed URLs
    }
  }

  return Array.from(links);
}

/**
 * Native single-page scraper.
 * @param {string} urlString
 * @param {number} [maxLength=8000]
 * @returns {Promise<object>}
 */
export async function nativeScrape(urlString, maxLength = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(urlString, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StyxCrawler/1.0; +https://github.com/styx)',
        'Accept': 'text/html,application/xhtml+xml,text/plain'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : urlString;

    let markdown = htmlToMarkdown(html);
    if (markdown.length > maxLength) {
      markdown = `${markdown.substring(0, maxLength)}\n\n... [Content truncated at ${maxLength} characters]`;
    }

    return {
      url: urlString,
      title,
      markdown,
      metadata: {
        title,
        sourceURL: urlString,
        statusCode: res.status,
        provider: 'native_crawler'
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Native BFS website crawler.
 * @param {object} params
 * @param {string} params.startUrl
 * @param {number} [params.limit=5]
 * @param {number} [params.maxDepth=2]
 * @param {boolean} [params.sameDomainOnly=true]
 * @returns {Promise<object>}
 */
export async function nativeCrawl({ startUrl, limit = 5, maxDepth = 2, sameDomainOnly = true }) {
  const visited = new Set();
  const results = [];
  const queue = [{ url: startUrl, depth: 1 }];

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;
    visited.add(current.url);

    try {
      logger.debug({ url: current.url, depth: current.depth }, 'Native crawl visiting page');
      const pageData = await nativeScrape(current.url, 4000);
      results.push(pageData);

      if (current.depth < maxDepth && results.length < limit) {
        // Fetch raw HTML for link extraction
        const res = await fetch(current.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyxCrawler/1.0)' }
        }).catch(() => null);

        if (res && res.ok) {
          const html = await res.text().catch(() => '');
          const links = extractLinks(html, current.url, sameDomainOnly);
          for (const link of links) {
            if (!visited.has(link)) {
              queue.push({ url: link, depth: current.depth + 1 });
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err: err.message, url: current.url }, 'Failed crawling page in native queue');
    }
  }

  return {
    status: 'completed',
    total: results.length,
    completed: results.length,
    provider: 'native_crawler',
    data: results
  };
}

export default {
  htmlToMarkdown,
  extractLinks,
  nativeScrape,
  nativeCrawl
};
