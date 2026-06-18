import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap: Record<string, string> = {};

export const getRecieverSocketId = (recieverId: string): string | undefined => {
  return userSocketMap[recieverId];
};

io.on("connection", (socket: Socket) => {
  console.log("User Connected", socket.id);

  const userId = socket.handshake.query.userId as string | undefined;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} mapped to socket ${socket.id}`);
  }

  io.emit("getOnlineUser", Object.keys(userSocketMap));

  if (userId) {
    socket.join(userId);
  }

  socket.on("typing", (data) => {
    console.log(`User ${data.userId} is typing in chat ${data.chatId}`);
    socket.to(data.chatId).emit("userTyping", {
      chatId: data.chatId,
      userId: data.userId,
    });
  });

  socket.on("stopTyping", (data) => {
    console.log(`User ${data.userId} stopped typing in chat ${data.chatId}`);
    socket.to(data.chatId).emit("userStoppedTyping", {
      chatId: data.chatId,
      userId: data.userId,
    });
  });

  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
    console.log(`User ${userId} joined chat room ${chatId}`);
  });

  socket.on("leaveChat", (chatId) => {
    socket.leave(chatId);
    console.log(`User ${userId} left chat room ${chatId}`);
  });

  // Call Signaling
  socket.on("callUser", (data) => {
    const receiverSocketId = getRecieverSocketId(data.userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("hey", {
        signal: data.signalData,
        from: data.from,
        name: data.name,
        type: data.type, // "voice" | "video"
      });
    }
  });

  socket.on("answerCall", (data) => {
    const callerSocketId = getRecieverSocketId(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("callAccepted", data.signal);
    }
  });

  socket.on("iceCandidate", (data) => {
    const targetSocketId = getRecieverSocketId(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("iceCandidate", data.candidate);
    }
  });

  socket.on("endCall", (data) => {
    const targetSocketId = getRecieverSocketId(data.to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("endCall");
    }
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);

    if (userId) {
      delete userSocketMap[userId];
      console.log(`User ${userId} removed from online users`);
      io.emit("getOnlineUser", Object.keys(userSocketMap));
    }
  });

  socket.on("connect_error", (error) => {
    console.log("Socket connection Error", error);
  });
});

export { app, server, io };
