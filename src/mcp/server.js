import { TOOL_DEFINITIONS } from './definitions.js';
import { scrapePage, crawlSite } from '../crawler/engine.js';
import logger from '../utils/logger.js';

export const SERVER_INFO = {
  name: 'styx-crawler-server',
  version: '1.0.0'
};

/**
 * Handles incoming JSON-RPC 2.0 requests following MCP spec.
 * @param {object} req
 * @returns {Promise<object|null>}
 */
export async function handleJsonRpc(req) {
  if (!req || typeof req !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request: payload must be a JSON object' }
    };
  }

  const { jsonrpc, id, method, params } = req;
  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc version must be "2.0"' }
    };
  }

  // MCP Notifications (e.g. notifications/initialized) require no response
  if (method?.startsWith('notifications/')) {
    logger.debug({ method }, 'Received MCP notification');
    return null;
  }

  switch (method) {
    case 'initialize': {
      logger.info({ clientVersion: params?.protocolVersion, client: params?.clientInfo }, 'MCP Client initializing');
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        }
      };
    }

    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOL_DEFINITIONS }
      };
    }

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      try {
        if (toolName === 'scrape_page') {
          const result = await scrapePage(args);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            }
          };
        }

        if (toolName === 'crawl_site') {
          const result = await crawlSite(args);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            }
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` }
        };
      } catch (err) {
        logger.error({ err: err.message, toolName }, 'Error executing crawler tool');
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error executing ${toolName}: ${err.message}` }],
            isError: true
          }
        };
      }
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
  }
}

export default { handleJsonRpc, SERVER_INFO };
