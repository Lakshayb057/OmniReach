import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { initializeDatabase } from './config/initDb';
import { setSocketIOInstance, startBackgroundWorker } from './services/worker';

import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import leadsRoutes from './routes/leadsRoutes';
import campaignsRoutes from './routes/campaignsRoutes';
import templatesRoutes from './routes/templatesRoutes';
import gatewaysRoutes from './routes/gatewaysRoutes';
import publicRoutes from './routes/publicRoutes';
import journeyRoutes from './routes/journeyRoutes';
import inboxRoutes from './routes/inboxRoutes';
import baileysRoutes from './routes/baileysRoutes';
import { seedDefaultJourneys } from './services/journeyEngine';
import { setSocketIOInstanceForBaileys, restoreAllBaileysSessions } from './services/baileysService';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { requestLoggerMiddleware } from './utils/logger';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLoggerMiddleware);

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setSocketIOInstance(io);
setSocketIOInstanceForBaileys(io);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected to WebSocket: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/gateways', gatewaysRoutes);
app.use('/api/journeys', journeyRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/baileys', baileysRoutes);
app.use('/api', publicRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'OmniReach - OmniChannel Campaigns & Broadcast Center',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend production build if dist exists
const distPath = path.join(__dirname, '../dist');
const publicPath = path.join(__dirname, '../public');
app.use(express.static(distPath));
app.use(express.static(publicPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Error handling fallback
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Start Server
async function startServer() {
  try {
    // 1. Ensure DB schema & seed Superadmin
    await initializeDatabase();
    await seedDefaultJourneys();

    // 2. Start Background Dispatch Worker (5-second poller)
    startBackgroundWorker(5000);

    // 3. Restore any previously authenticated WhatsApp Baileys multi-device sessions
    await restoreAllBaileysSessions();

    // 4. Listen on HTTP & WebSocket port
    server.listen(PORT, () => {
      console.log(`\n========================================================`);
      console.log(`🚀 OmniReach Broadcast Center Backend Ready`);
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSockets active for live countdowns & UI sync`);
      console.log(`👑 Superadmin seeded: SuplerLucky@gmail.com`);
      console.log(`========================================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
