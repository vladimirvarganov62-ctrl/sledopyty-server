
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = new Map();

function makeCode() {
  let code;
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

app.get("/", (req, res) => {
  res.send("Следопыты: сервер мультиплеера работает!");
});

io.on("connection", socket => {
  let roomCode = null;

  socket.on("room:create", ({ name } = {}) => {
    if (roomCode) return;

    const code = makeCode();
    const player = {
      id: socket.id,
      name: String(name || "Следопыт").slice(0, 20),
      x: 0,
      y: 0,
      health: 100,
      food: 100
    };

    rooms.set(code, new Map([[socket.id, player]]));
    roomCode = code;
    socket.join(code);

    socket.emit("room:created", {
      code,
      players: [...rooms.get(code).values()]
    });
  });

  socket.on("room:join", ({ code, name } = {}) => {
    if (roomCode) return;

    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit("room:error", "Комната не найдена");
      return;
    }

    const player = {
      id: socket.id,
      name: String(name || "Следопыт").slice(0, 20),
      x: 0,
      y: 0,
      health: 100,
      food: 100
    };

    room.set(socket.id, player);
    roomCode = code;
    socket.join(code);

    socket.emit("room:joined", {
      code,
      players: [...room.values()]
    });

    socket.to(code).emit("player:joined", player);
  });

  socket.on("player:update", data => {
    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    const player = room.get(socket.id);
    if (!player) return;

    player.x = Number.isFinite(data?.x) ? data.x : player.x;
    player.y = Number.isFinite(data?.y) ? data.y : player.y;
    player.health = Number.isFinite(data?.health)
      ? Math.max(0, Math.min(100, data.health))
      : player.health;
    player.food = Number.isFinite(data?.food)
      ? Math.max(0, Math.min(100, data.food))
      : player.food;

    socket.to(roomCode).emit("player:updated", player);
  });

  socket.on("disconnect", () => {
    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    room.delete(socket.id);
    socket.to(roomCode).emit("player:left", socket.id);

    if (room.size === 0) rooms.delete(roomCode);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Следопыты запущены на порту " + PORT);
});
        
