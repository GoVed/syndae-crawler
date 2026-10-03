import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export const config = {
  crawlerUrl: process.env.CRAWLER_URL || 'http://192.168.1.2:3000',
  httpPort: parseInt(process.env.HTTP_PORT || '8768', 10),
  httpHost: process.env.HTTP_HOST || '0.0.0.0',
  syndaeApiUrl: process.env.SYNDAE_API_URL || 'http://localhost:3000',
  syndaeAccessKey: process.env.SYNDAE_ACCESS_KEY || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  timeoutMs: parseInt(process.env.CRAWLER_TIMEOUT_MS || '30000', 10),
  rootDir: path.resolve(__dirname, '..')
};

export default config;
