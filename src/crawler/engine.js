import config from '../config.js';
import logger from '../utils/logger.js';
import { nativeScrape, nativeCrawl } from './native.js';

/**
 * Normalizes crawler endpoint into base URL.
 * @param {string} [customUrl]
 * @returns {{ baseUrl: string, scrapeUrl: string, crawlUrl: string }}
 */
export function resolveCrawlerEndpoints(customUrl) {
  const target = (customUrl || config.crawlerUrl || '').trim().replace(/\/$/, '');
  if (!target) {
    return { baseUrl: '', scrapeUrl: '', crawlUrl: '' };
  }

  // If user provided direct endpoint like http://192.168.1.2:3000/v2/scrape
  if (target.endsWith('/v2/scrape')) {
    const base = target.replace(/\/v2\/scrape$/, '');
    return { baseUrl: base, scrapeUrl: target, crawlUrl: `${base}/v2/crawl` };
  }
  if (target.endsWith('/v2/crawl')) {
    const base = target.replace(/\/v2\/crawl$/, '');
    return { baseUrl: base, scrapeUrl: `${base}/v2/scrape`, crawlUrl: target };
  }

  // Base URL provided like http://192.168.1.2:3000
  return {
    baseUrl: target,
    scrapeUrl: `${target}/v2/scrape`,
    crawlUrl: `${target}/v2/crawl`
  };
}

/**
 * Scrapes a single webpage into clean Markdown.
 * Tries external crawler first, falls back to native scraper.
 *
 * @param {object} params
 * @param {string} params.url
 * @param {string} [params.crawler_url]
 * @param {boolean} [params.only_main_content=true]
 * @param {number} [params.wait_for]
 * @param {number} [params.max_length=12000]
 * @returns {Promise<object>}
 */
export async function scrapePage(params) {
  const { url, crawler_url, only_main_content = true, wait_for, max_length = 12000 } = params;

  if (!url || typeof url !== 'string') {
    throw new Error('Valid URL string is required');
  }

  const { scrapeUrl } = resolveCrawlerEndpoints(crawler_url);

  if (scrapeUrl) {
    try {
      logger.info({ url, scrapeUrl }, 'Attempting scrape via external crawler API');
      const payload = {
        url,
        formats: ['markdown'],
        onlyMainContent: Boolean(only_main_content)
      };
      if (typeof wait_for === 'number' && wait_for > 0) {
        payload.waitFor = wait_for;
      }

      const res = await fetch(scrapeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        const body = await res.json();
        if (body?.data?.markdown || body?.markdown) {
          const markdown = body.data?.markdown || body.markdown;
          const metadata = body.data?.metadata || body.metadata || {};
          return {
            success: true,
            provider: 'external_crawler',
            url,
            title: metadata.title || '',
            markdown: markdown.length > max_length
              ? `${markdown.substring(0, max_length)}\n\n... [Content truncated at ${max_length} characters]`
              : markdown,
            metadata
          };
        }
      }
      logger.warn({ status: res.status, url }, 'External crawler returned non-OK status, falling back to native');
    } catch (err) {
      logger.warn({ err: err.message, url }, 'External crawler request failed, using native scraper fallback');
    }
  }

  // Native fallback
  logger.info({ url }, 'Scraping page via native scraper engine');
  const nativeResult = await nativeScrape(url, max_length);
  return {
    success: true,
    provider: 'native_crawler',
    url: nativeResult.url,
    title: nativeResult.title,
    markdown: nativeResult.markdown,
    metadata: nativeResult.metadata
  };
}

/**
 * Crawls a website recursively starting from seed URL.
 * Tries external crawler first, falls back to native BFS crawler.
 *
 * @param {object} params
 * @param {string} params.url
 * @param {string} [params.crawler_url]
 * @param {number} [params.limit=5]
 * @param {number} [params.max_depth=2]
 * @param {boolean} [params.same_domain_only=true]
 * @param {number} [params.timeout_ms=30000]
 * @returns {Promise<object>}
 */
export async function crawlSite(params) {
  const { url, crawler_url, limit = 5, max_depth = 2, same_domain_only = true, timeout_ms = 30000 } = params;

  if (!url || typeof url !== 'string') {
    throw new Error('Valid seed URL string is required');
  }

  const { crawlUrl, baseUrl } = resolveCrawlerEndpoints(crawler_url);

  if (crawlUrl) {
    try {
      logger.info({ url, crawlUrl, limit, max_depth }, 'Initiating site crawl via external crawler API');
      const startRes = await fetch(crawlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          limit: Math.min(limit, 20),
          maxDepth: max_depth,
          scrapeOptions: { formats: ['markdown'] }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (startRes.ok) {
        const startData = await startRes.json();
        const jobId = startData.id;
        const jobUrl = startData.url || (jobId ? `${baseUrl}/v2/crawl/${jobId}` : null);

        if (jobUrl) {
          // Poll for completion
          const startTime = Date.now();
          while (Date.now() - startTime < timeout_ms) {
            await new Promise(r => setTimeout(r, 1500));
            const pollRes = await fetch(jobUrl, { signal: AbortSignal.timeout(6000) });
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              if (pollData.status === 'completed' || pollData.status === 'failed') {
                const pages = (pollData.data || []).map(p => ({
                  url: p.metadata?.url || p.metadata?.sourceURL || url,
                  title: p.metadata?.title || '',
                  markdown: p.markdown || '',
                  metadata: p.metadata || {}
                }));

                return {
                  success: true,
                  provider: 'external_crawler',
                  status: pollData.status,
                  total_pages: pages.length,
                  pages
                };
              }
            }
          }
          logger.warn({ url, jobId }, 'External crawl job polling timed out, using results or falling back');
        }
      }
    } catch (err) {
      logger.warn({ err: err.message, url }, 'External crawl failed, falling back to native crawler');
    }
  }

  // Native fallback
  logger.info({ url, limit, max_depth }, 'Executing native BFS crawler fallback');
  const nativeData = await nativeCrawl({
    startUrl: url,
    limit,
    maxDepth: max_depth,
    sameDomainOnly: same_domain_only
  });

  return {
    success: true,
    provider: 'native_crawler',
    status: nativeData.status,
    total_pages: nativeData.total,
    pages: nativeData.data.map(p => ({
      url: p.url,
      title: p.title,
      markdown: p.markdown,
      metadata: p.metadata
    }))
  };
}

export default {
  resolveCrawlerEndpoints,
  scrapePage,
  crawlSite
};
