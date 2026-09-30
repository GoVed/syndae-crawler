import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleJsonRpc, SERVER_INFO } from './server.js';
import { scrapePage, crawlSite } from '../crawler/engine.js';
import config from '../config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates Express application for Crawler MCP HTTP transport.
 * @returns {import('express').Express}
 */
export function createHttpApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Styx-Access-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const jsonRpcHandler = async (req, res) => {
    try {
      const resp = await handleJsonRpc(req.body);
      if (resp) return res.json(resp);
      return res.status(204).end();
    } catch (err) {
      logger.error({ err }, 'Error in crawler HTTP JSON-RPC handler');
      return res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id ?? null,
        error: { code: -32603, message: err.message }
      });
    }
  };

  app.post('/', jsonRpcHandler);
  app.post('/mcp', jsonRpcHandler);

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      crawlerUrl: config.crawlerUrl,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/status', (req, res) => {
    res.json({
      server: SERVER_INFO,
      config: {
        crawlerUrl: config.crawlerUrl,
        httpPort: config.httpPort,
        httpHost: config.httpHost
      }
    });
  });

  app.get('/instructions', (req, res) => {
    try {
      const p = path.resolve(__dirname, '../../instructions.md');
      if (fs.existsSync(p)) {
        return res.json({
          success: true,
          name: 'crawler',
          title: 'Skillset: Web Crawler & Scraper Integration',
          instructions: fs.readFileSync(p, 'utf8')
        });
      }
      return res.status(404).json({ success: false, error: 'instructions.md not found' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // REST Scrape endpoint
  app.post('/scrape', async (req, res) => {
    try {
      const result = await scrapePage(req.body || {});
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // REST Crawl endpoint
  app.post('/crawl', async (req, res) => {
    try {
      const result = await crawlSite(req.body || {});
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  return app;
}

/**
 * Starts the HTTP server on configured port and host.
 * @param {object} [options]
 * @returns {Promise<{ server: import('node:http').Server, app: import('express').Express, port: number, host: string }>}
 */
export async function startHttpServer(options = {}) {
  const port = options.port || config.httpPort;
  const host = options.host || config.httpHost;
  const app = createHttpApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      logger.info(
        { port, host, crawlerUrl: config.crawlerUrl },
        `Styx Crawler MCP HTTP Server listening at http://${host}:${port}`
      );
      resolve({ server, app, port, host });
    });

    server.on('error', (err) => {
      logger.error({ err, port, host }, 'HTTP server listen error');
      reject(err);
    });
  });
}

export default { createHttpApp, startHttpServer };
