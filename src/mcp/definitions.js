/**
 * MCP tool catalog definitions for Web Crawler & Scraper tool (2024-11-05 spec).
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'scrape_page',
    description: 'Scrape a webpage URL into clean, structured Markdown and metadata using a configured crawler or headless scraper.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full HTTP/HTTPS URL of the webpage to scrape'
        },
        crawler_url: {
          type: 'string',
          description: 'Optional custom crawler endpoint override (e.g., "http://192.168.1.2:3000/v2/scrape")'
        },
        only_main_content: {
          type: 'boolean',
          description: 'Whether to extract only the main content body (default: true)'
        },
        wait_for: {
          type: 'number',
          description: 'Optional milliseconds to wait for dynamic JavaScript content to render'
        },
        max_length: {
          type: 'number',
          description: 'Maximum characters of markdown to extract (default: 12000)'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'crawl_site',
    description: 'Recursively crawl a website starting from a seed URL, following internal links up to a limit or depth.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Seed HTTP/HTTPS URL to begin multi-page crawling'
        },
        crawler_url: {
          type: 'string',
          description: 'Optional custom crawler endpoint override (e.g., "http://192.168.1.2:3000")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of pages to crawl (default: 5, max: 20)'
        },
        max_depth: {
          type: 'number',
          description: 'Maximum crawl depth from starting URL (default: 2)'
        },
        same_domain_only: {
          type: 'boolean',
          description: 'Stay strictly within the starting domain (default: true)'
        }
      },
      required: ['url']
    }
  }
];

export default { TOOL_DEFINITIONS };
