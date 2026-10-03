import { Command } from 'commander';
import { startHttpServer } from './mcp/http.js';
import { scrapePage, crawlSite } from './crawler/engine.js';
import config from './config.js';

const program = new Command();

program
  .name('syndae-crawler')
  .description('Syndae Web Crawler & Scraper MCP Tool')
  .version('1.0.0');

program
  .command('daemon')
  .description('Start the Web Crawler MCP HTTP daemon')
  .action(() => {
    startHttpServer();
  });

program
  .command('scrape <url>')
  .description('Scrape a webpage into Markdown')
  .option('-c, --crawler-url <url>', 'Custom crawler endpoint')
  .action(async (url, opts) => {
    try {
      const res = await scrapePage({ url, crawler_url: opts.crawlerUrl });
      console.log(`Title: ${res.title}\nURL: ${res.url}\n\n${res.markdown}`);
    } catch (err) {
      console.error('Scrape failed:', err.message);
      process.exit(1);
    }
  });

program
  .command('crawl <url>')
  .description('Crawl a website starting from seed URL')
  .option('-l, --limit <number>', 'Page limit', '5')
  .option('-d, --depth <number>', 'Max depth', '2')
  .action(async (url, opts) => {
    try {
      const res = await crawlSite({
        url,
        limit: parseInt(opts.limit, 10),
        max_depth: parseInt(opts.depth, 10)
      });
      console.log(JSON.stringify(res, null, 2));
    } catch (err) {
      console.error('Crawl failed:', err.message);
      process.exit(1);
    }
  });

if (process.argv.length <= 2) {
  startHttpServer();
} else {
  program.parse(process.argv);
}

export * from './crawler/engine.js';
export * from './mcp/server.js';
