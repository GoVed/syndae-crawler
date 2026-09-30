import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { htmlToMarkdown, extractLinks, nativeScrape, nativeCrawl } from '../src/crawler/native.js';
import { resolveCrawlerEndpoints, scrapePage, crawlSite } from '../src/crawler/engine.js';
import { handleJsonRpc } from '../src/mcp/server.js';
import { createHttpApp } from '../src/mcp/http.js';

test('Crawler Native Module', async (t) => {
  await t.test('htmlToMarkdown strips scripts and formats clean markdown', () => {
    const html = `
      <html>
        <head><title>Test Page</title><script>alert(1);</script></head>
        <body>
          <nav>Nav links</nav>
          <h1>Main Title</h1>
          <p>This is a paragraph with <a href="https://example.com">a link</a>.</p>
          <ul><li>Item 1</li><li>Item 2</li></ul>
          <footer>Footer copyright</footer>
        </body>
      </html>
    `;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes('### Main Title'));
    assert.ok(md.includes('[a link](https://example.com)'));
    assert.ok(md.includes('* Item 1'));
    assert.ok(!md.includes('alert(1)'));
    assert.ok(!md.includes('Nav links'));
    assert.ok(!md.includes('Footer copyright'));
  });

  await t.test('extractLinks resolves relative URLs and respects domain boundaries', () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://mysite.com/contact">Contact</a>
      <a href="https://other.com/external">External</a>
      <a href="#section">Hash</a>
      <a href="javascript:void(0)">JS</a>
    `;
    const internalLinks = extractLinks(html, 'https://mysite.com', true);
    assert.strictEqual(internalLinks.length, 2);
    assert.ok(internalLinks.includes('https://mysite.com/about'));
    assert.ok(internalLinks.includes('https://mysite.com/contact'));
    assert.ok(!internalLinks.includes('https://other.com/external'));

    const allLinks = extractLinks(html, 'https://mysite.com', false);
    assert.ok(allLinks.includes('https://other.com/external'));
  });
});

test('Crawler Engine & Endpoint Resolution', async (t) => {
  await t.test('resolveCrawlerEndpoints normalizes paths properly', () => {
    const r1 = resolveCrawlerEndpoints('http://192.168.1.2:3000/v2/scrape');
    assert.strictEqual(r1.baseUrl, 'http://192.168.1.2:3000');
    assert.strictEqual(r1.scrapeUrl, 'http://192.168.1.2:3000/v2/scrape');
    assert.strictEqual(r1.crawlUrl, 'http://192.168.1.2:3000/v2/crawl');

    const r2 = resolveCrawlerEndpoints('http://192.168.1.2:3000');
    assert.strictEqual(r2.baseUrl, 'http://192.168.1.2:3000');
    assert.strictEqual(r2.scrapeUrl, 'http://192.168.1.2:3000/v2/scrape');
    assert.strictEqual(r2.crawlUrl, 'http://192.168.1.2:3000/v2/crawl');
  });

  await t.test('scrapePage successfully scrapes via external or native fallback', async () => {
    const result = await scrapePage({
      url: 'https://example.com',
      only_main_content: true
    });
    assert.strictEqual(result.success, true);
    assert.ok(result.markdown.includes('Example Domain'));
    assert.strictEqual(result.url, 'https://example.com');
  });
});

test('MCP Protocol JSON-RPC 2.0 Handler', async (t) => {
  await t.test('handles initialize handshake', async () => {
    const req = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    };
    const res = await handleJsonRpc(req);
    assert.strictEqual(res.id, 1);
    assert.strictEqual(res.result.protocolVersion, '2024-11-05');
    assert.strictEqual(res.result.serverInfo.name, 'styx-crawler-server');
  });

  await t.test('handles tools/list returning scrape_page and crawl_site', async () => {
    const req = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
    const res = await handleJsonRpc(req);
    assert.strictEqual(res.result.tools.length, 2);
    const names = res.result.tools.map(t => t.name);
    assert.ok(names.includes('scrape_page'));
    assert.ok(names.includes('crawl_site'));
  });

  await t.test('handles tools/call for scrape_page', async () => {
    const req = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'scrape_page',
        arguments: { url: 'https://example.com' }
      }
    };
    const res = await handleJsonRpc(req);
    assert.strictEqual(res.result.isError, false);
    const data = JSON.parse(res.result.content[0].text);
    assert.strictEqual(data.success, true);
    assert.ok(data.markdown.includes('Example Domain'));
  });
});

test('HTTP Server & REST Endpoints', async (t) => {
  const app = createHttpApp();
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/health`).then(r => r.json());
    assert.strictEqual(health.status, 'healthy');

    const status = await fetch(`${baseUrl}/status`).then(r => r.json());
    assert.strictEqual(status.server.name, 'styx-crawler-server');

    const mcpRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/list' })
    }).then(r => r.json());
    assert.strictEqual(mcpRes.result.tools.length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
