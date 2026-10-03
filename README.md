# Syndae Crawler & Web Scraper Micro-Daemon

High-performance web scraping and site crawling tool for **Syndae AI Agent OS**, exposing standard JSON-RPC 2.0 MCP endpoints (`scrape_page`, `crawl_site`) and native fallback extraction.

## Features
- **MCP 2024-11-05 Compliant**: Plugs into Syndae Agent OS or any MCP host via HTTP or STDIO.
- **`scrape_page`**: Extracts clean, readable Markdown from any web page.
- **`crawl_site`**: Multi-page recursive crawler with depth and domain boundary controls.
- **Engine Agnostic**: Direct support for external Firecrawl/Crawl4AI instances via `CRAWLER_URL` with automatic local in-process fallback.
- **Container Ready**: Includes lightweight Dockerfile and docker-compose deployment.

## Installation & Setup

```bash
git clone git@github.com:syndae-org/syndae-crawler.git
cd syndae-crawler
npm install
npm test
```

## Running the Daemon

```bash
# Direct node execution
PORT=8768 npm start

# Or using Docker
docker-compose up -d
```

## MCP Tools Exposed

| Tool | Parameters | Description |
|---|---|---|
| `scrape_page` | `url`, `only_main_content`, `wait_for`, `max_length` | Scrape a single URL into structured markdown |
| `crawl_site` | `url`, `limit`, `max_depth`, `same_domain_only` | Recursively crawl linked pages within a domain |

## License
MIT
