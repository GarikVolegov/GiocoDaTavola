import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { RoomStore } from './game/rooms';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// Authoritative in-memory room store (no DB).
const rooms = new RoomStore();
// Which room each host socket owns, so a re-emit (e.g. React StrictMode's
// double-mount in dev) recovers the same room instead of creating a new one.
const hostRooms = new Map<string, string>();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  console.log('[server] client connected:', socket.id);

  // A host opening /host requests a room; reuse this socket's room if it still
  // exists so the host always sees a single, stable code.
  socket.on('host:createRoom', () => {
    let code = hostRooms.get(socket.id);
    if (!code || !rooms.has(code)) {
      code = rooms.create().code;
      hostRooms.set(socket.id, code);
    }
    socket.emit('host:roomCreated', { code });
  });

  socket.on('disconnect', () => {
    hostRooms.delete(socket.id);
  });
});

// In production the server serves the built client from client/dist.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
