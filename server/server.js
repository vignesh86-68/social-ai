require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const app = require('./app');
const connectDB = require('./src/config/db');

const { isOriginAllowed } = require('./src/config/cors');

const PORT = process.env.PORT || 5000;

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
});

// Socket authentication middleware – graceful: unauthenticated sockets connect
// but won't join a private room, so they cannot receive private notifications.
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    socket.userId = null; // anonymous – no private room
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    socket.userId = null; // expired/invalid token – treat as anonymous
    next();
  }
});

io.on('connection', (socket) => {
  if (socket.userId) {
    // Each authenticated user joins their own private room
    socket.join(socket.userId);
    console.log(`🔌 Socket connected: user ${socket.userId}`);
  }

  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`🔌 Socket disconnected: user ${socket.userId}`);
    }
  });
});

// Attach io to app so controllers can emit events
app.set('io', io);

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Social AI server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Stop the other process or change PORT in .env`);
      process.exit(1);
    } else {
      throw err;
    }
  });
};

start();

module.exports = { app, server };
