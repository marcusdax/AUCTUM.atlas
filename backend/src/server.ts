/**
 * RoofPro CRM — Backend Server
 *
 * Transforms Atlas Helios storm intelligence into RoofPro CRM:
 * - Retains NOAA weather/storm tracking (maps, alerts, forecasts)
 * - Adds CRM: leads, jobs, estimates, calendar, job feed, documents, reporting
 * - WebSocket for real-time job feed & notifications
 * - Redis for sessions, caching, and pub/sub
 * - Prisma + PostgreSQL for all data
 */

import { createServer } from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import winston from 'winston';
import { prisma } from './prisma';
import jwt from 'jsonwebtoken';

import v1Router from './routes/index';
import { authMiddleware, AuthRequest } from './middleware/auth';
import fs from 'fs';

// Configure environment
dotenv.config();

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

const app = express();
const PORT = process.env.PORT || 5000;
const server = createServer(app);

// ─── Socket.IO ───────────────────────────────────────────
// ─── Socket.IO ───────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004').split(',').map(s => s.trim());

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Try to use Redis adapter, fall back to in-memory
async function setupSocketAdapter() {
  try {
    const { getRedis } = await import('./config/redis');
    const redis = getRedis();
    if (redis) {
      // Use a dedicated subscriber connection so the shared cache client never
      // enters subscriber mode. ioredis forbids regular commands (get/setex/del)
      // on a subscribed connection, and cacheGet/cacheSet/cacheDel reuse this
      // same client via the redis config module.
      const RedisCtor = (await import('ioredis')).default;
      const subRedis = new RedisCtor(
        process.env.REDIS_URL || 'redis://localhost:6379'
      );
      io.adapter(createAdapter(redis, subRedis));
      logger.info('Socket.IO using Redis adapter');
    } else {
      logger.info('Socket.IO using in-memory adapter (no Redis)');
    }
  } catch (err) {
    logger.warn('Redis adapter unavailable, using in-memory', {
      error: (err as Error).message,
    });
  }
}

setupSocketAdapter();

// ─── Middleware ──────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files (documents, attachments, logos, estimate PDFs, etc.)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ─── Socket.IO Connection Handler ───────────────────────
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  // Authenticate socket via JWT
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'roofpro-crm-super-secret-key-change-in-production') as {
        userId: string;
        companyId: string;
      };
      socket.data.userId = payload.userId;
      socket.data.companyId = payload.companyId;

      // Join company room for company-wide broadcasts
      socket.join(`company:${payload.companyId}`);

      // Join per-user room so direct notifications reach this client
      // (route handlers emit `notification.new` to `user:${userId}`)
      socket.join(`user:${payload.userId}`);
    } catch (err) {
      logger.warn('Socket auth failed', { error: (err as Error).message });
    }
  }

  // Join job-specific rooms
  socket.on('join:job', (jobId: string) => {
    socket.join(`job:${jobId}`);
  });

  socket.on('leave:job', (jobId: string) => {
    socket.leave(`job:${jobId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Make io available to route handlers (set before route handlers run)
app.set('io', io);

// ─── Web-vitals ingest (sendBeacon, unauthenticated, best-effort) ─────
app.post('/api/analytics/vitals', (req, res) => {
  const metric = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof metric.name === 'string' ? metric.name.slice(0, 16) : 'unknown';
  const value = Number(metric.value);
  if (Number.isFinite(value) && Number.isFinite(Number(metric.timestamp))) {
    logger.debug('web-vital', {
      name,
      value: Math.round(value * 100) / 100,
      rating: typeof metric.rating === 'string' ? metric.rating.slice(0, 16) : undefined,
      navigationType: typeof metric.navigationType === 'string' ? metric.navigationType.slice(0, 24) : undefined,
      url: typeof metric.url === 'string' ? metric.url.slice(0, 300) : undefined,
    });
  }
  res.status(204).end();
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/v1', v1Router);

// ─── Error Handling ──────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Body-parser errors happen before any router: answer with a client error, not a 500.
  const parserError = err as Error & { type?: string; status?: number; statusCode?: number };
  if (parserError.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON body',
      code: 'INVALID_JSON',
      timestamp: new Date().toISOString(),
    });
  }
  if (parserError.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
      timestamp: new Date().toISOString(),
    });
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    timestamp: new Date().toISOString(),
  });
});

// ─── Start Server ────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`🚀 RoofPro CRM API Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
  logger.info(`🌦️  Weather API: http://localhost:${PORT}/api/v1/weather`);
  logger.info(`⛈️  Storm API: http://localhost:${PORT}/api/v1/storms`);
  logger.info(`👷 CRM API: http://localhost:${PORT}/api/v1/`);
  logger.info(`🔌 Socket.IO active on port ${PORT}`);
});

export { app, io, server };
export default server;
