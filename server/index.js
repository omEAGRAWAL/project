import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Store connected users
const users = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    users.set(socket.id, { username, inCall: false });
    io.emit('userList', Array.from(users.values()));
  });

  // Handle chat messages
  socket.on('message', (data) => {
    io.emit('message', {
      user: users.get(socket.id)?.username,
      text: data.text,
      timestamp: new Date()
    });
  });

  // Handle video call signaling
  socket.on('callUser', ({ userToCall, signalData, from }) => {
    io.to(userToCall).emit('callUser', {
      signal: signalData,
      from,
      username: users.get(from)?.username
    });
  });

  socket.on('answerCall', (data) => {
    io.to(data.to).emit('callAccepted', data.signal);
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('userList', Array.from(users.values()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});