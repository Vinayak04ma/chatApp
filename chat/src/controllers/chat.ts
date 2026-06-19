import axios from "axios";
import TryCatch from "../config/TryCatch.js";
import { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/Messages.js";
import { getRecieverSocketId, io } from "../config/socket.js";

// In-memory cache for user profiles to prevent excessive inter-service HTTP requests
const userCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

async function fetchUserWithCache(userId: string) {
  const now = Date.now();
  const cached = userCache.get(userId);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  
  const { data } = await axios.get(
    `${process.env.USER_SERVICE}/api/v1/user/${userId}`
  );
  
  userCache.set(userId, { data, timestamp: now });
  return data;
}

export const createNewChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      res.status(400).json({
        message: "Other userid is required",
      });
      return;
    }

    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });

    if (existingChat) {
      res.json({
        message: "Chat already exitst",
        chatId: existingChat._id,
      });
      return;
    }

    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });

    res.status(201).json({
      message: "New Chat created",
      chatId: newChat._id,
    });
  }
);

export const getAllChats = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(400).json({
      message: " UserId missing",
    });
    return;
  }

  const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

  const chatWithUserData = await Promise.all(
    chats.map(async (chat) => {
      const otherUserId = chat.users.find((id) => id !== userId);

      const unseenCount = await Messages.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        seen: false,
      });

      try {
        const userData = await fetchUserWithCache(otherUserId!);

        return {
          user: userData,
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      } catch (error) {
        console.log(error);
        return {
          user: { _id: otherUserId, name: "Unknown User" },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      }
    })
  );

  res.json({
    chats: chatWithUserData,
  });
});

export const sendMessage = TryCatch(async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?._id;
  const { chatId, text } = req.body;
  const files = req.files as { [fieldname: string]: any[] } | undefined;
  const imageFile = files?.image?.[0];
  const audioFile = files?.audio?.[0];

  if (!senderId) {
    res.status(401).json({
      message: "unauthorized",
    });
    return;
  }
  if (!chatId) {
    res.status(400).json({
      message: "ChatId Required",
    });
    return;
  }

  if (!text && !imageFile && !audioFile) {
    res.status(400).json({
      message: "Either text, image or audio is required",
    });
    return;
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404).json({
      message: "Chat not found",
    });
    return;
  }

  const isUserInChat = chat.users.some(
    (userId) => userId.toString() === senderId.toString()
  );

  if (!isUserInChat) {
    res.status(403).json({
      message: "You are not a participant of this chat",
    });
    return;
  }

  const otherUserId = chat.users.find(
    (userId) => userId.toString() !== senderId.toString()
  );

  if (!otherUserId) {
    res.status(401).json({
      message: "No other user",
    });
    return;
  }

  //socket setup
  const receiverSocketId = getRecieverSocketId(otherUserId.toString());
  let isReceiverInChatRoom = false;

  if (receiverSocketId) {
    const receiverSocket = io.sockets.sockets.get(receiverSocketId);
    if (receiverSocket && receiverSocket.rooms.has(chatId)) {
      isReceiverInChatRoom = true;
    }
  }

  let messageData: any = {
    chatId: chatId,
    sender: senderId,
    seen: isReceiverInChatRoom,
    seenAt: isReceiverInChatRoom ? new Date() : undefined,
  };

  if (imageFile) {
    messageData.image = {
      url: imageFile.path,
      publicId: imageFile.filename,
    };
    messageData.messageType = "image";
    messageData.text = text || "";
  } else if (audioFile) {
    messageData.audio = {
      url: audioFile.path,
      publicId: audioFile.filename,
    };
    messageData.messageType = "audio";
    messageData.text = text || "";
  } else {
    messageData.text = text;
    messageData.messageType = "text";
  }

  const message = new Messages(messageData);

  const savedMessage = await message.save();

  const latestMessageText = imageFile ? "📷 Image" : audioFile ? "🎵 Voice message" : text;

  await Chat.findByIdAndUpdate(
    chatId,
    {
      latestMessage: {
        text: latestMessageText,
        sender: senderId,
      },
      updatedAt: new Date(),
    },
    { new: true }
  );

  //emit to sockets
  io.to(chatId).emit("newMessage", savedMessage);

  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", savedMessage);
  }

  const senderSocketId = getRecieverSocketId(senderId.toString());
  if (senderSocketId) {
    io.to(senderSocketId).emit("newMessage", savedMessage);
  }

  if (isReceiverInChatRoom && senderSocketId) {
    io.to(senderSocketId).emit("messagesSeen", {
      chatId: chatId,
      seenBy: otherUserId,
      messageIds: [savedMessage._id],
    });
  }

  res.status(201).json({
    message: savedMessage,
    sender: senderId,
  });
});

export const getMessagesByChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    if (!chatId) {
      res.status(400).json({
        message: "ChatId Required",
      });
      return;
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      res.status(404).json({
        message: "Chat not found",
      });
      return;
    }

    const isUserInChat = chat.users.some(
      (userId) => userId.toString() === userId.toString()
    );

    if (!isUserInChat) {
      res.status(403).json({
        message: "You are not a participant of this chat",
      });
      return;
    }

    const messagesToMarkSeen = await Messages.find({
      chatId: chatId,
      sender: { $ne: userId },
      seen: false,
    });

    await Messages.updateMany(
      {
        chatId: chatId,
        sender: { $ne: userId },
        seen: false,
      },
      {
        seen: true,
        seenAt: new Date(),
      }
    );

    const messages = await Messages.find({ chatId }).sort({ createdAt: 1 });
    const otherUserId = chat.users.find((id) => id !== userId);

    if (!otherUserId) {
      res.status(400).json({
        message: "No other user",
      });
      return;
    }

    try {
      const userData = await fetchUserWithCache(otherUserId.toString());

      //socket work
      if (messagesToMarkSeen.length > 0) {
        const otherUserSocketId = getRecieverSocketId(otherUserId.toString());
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("messagesSeen", {
            chatId: chatId,
            seenBy: userId,
            messageIds: messagesToMarkSeen.map((msg) => msg._id),
          });
        }
      }

      res.json({
        messages,
        user: userData,
      });
    } catch (error) {
      console.log(error);
      res.json({
        messages,
        user: { _id: otherUserId, name: "Unknown User" },
      });
    }
  }
);

export const deleteMessage = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { messageId } = req.params;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const message = await Messages.findById(messageId);
    if (!message) {
      res.status(404).json({
        message: "Message not found",
      });
      return;
    }

    if (message.sender.toString() !== userId.toString()) {
      res.status(403).json({
        message: "You can only delete your own messages",
      });
      return;
    }

    const chatId = message.chatId;
    await Messages.findByIdAndDelete(messageId);

    // If it was the latest message, we need to update the chat
    const chat = await Chat.findById(chatId);
    if (chat) {
      const latestMsg = await Messages.findOne({ chatId }).sort({
        createdAt: -1,
      });
      if (latestMsg) {
        let latestText = "";
        if (latestMsg.messageType === "image") {
          latestText = "📷 Image";
        } else if (latestMsg.messageType === "audio") {
          latestText = "🎵 Voice message";
        } else {
          latestText = latestMsg.text || "";
        }
        await Chat.findByIdAndUpdate(chatId, {
          latestMessage: {
            text: latestText,
            sender: latestMsg.sender,
          },
        });
      } else {
        await Chat.findByIdAndUpdate(chatId, {
          $unset: { latestMessage: "" },
        });
      }
    }

    // Emit socket event
    io.to(chatId.toString()).emit("messageDeleted", { chatId, messageId });

    if (chat) {
      const otherUserId = chat.users.find(
        (id) => id.toString() !== userId.toString()
      );
      if (otherUserId) {
        const receiverSocketId = getRecieverSocketId(otherUserId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageDeleted", { chatId, messageId });
        }
      }
    }

    res.json({
      message: "Message deleted successfully",
    });
  }
);

export const editMessage = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { messageId } = req.params;
    const { text } = req.body;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    if (!text || !text.trim()) {
      res.status(400).json({
        message: "Text content is required to edit",
      });
      return;
    }

    const message = await Messages.findById(messageId);
    if (!message) {
      res.status(404).json({
        message: "Message not found",
      });
      return;
    }

    if (message.sender.toString() !== userId.toString()) {
      res.status(403).json({
        message: "You can only edit your own messages",
      });
      return;
    }

    message.text = text;
    const updatedMessage = await message.save();

    // If it is the latest message, update the chat's latestMessage
    const chatId = message.chatId;
    const chat = await Chat.findById(chatId);
    if (chat) {
      const latestMsg = await Messages.findOne({ chatId }).sort({
        createdAt: -1,
      });
      if (latestMsg && (latestMsg._id as any).toString() === messageId) {
        await Chat.findByIdAndUpdate(chatId, {
          latestMessage: {
            text: text,
            sender: userId,
          },
        });
      }
    }

    // Emit socket event
    io.to(chatId.toString()).emit("messageEdited", updatedMessage);

    if (chat) {
      const otherUserId = chat.users.find(
        (id) => id.toString() !== userId.toString()
      );
      if (otherUserId) {
        const receiverSocketId = getRecieverSocketId(otherUserId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messageEdited", updatedMessage);
        }
      }
    }

    res.json({
      message: updatedMessage,
    });
  }
);

export const deleteChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({
        message: "Chat not found",
      });
      return;
    }

    const isUserInChat = chat.users.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isUserInChat) {
      res.status(403).json({
        message: "You are not a participant of this chat",
      });
      return;
    }

    await Chat.findByIdAndDelete(chatId);
    await Messages.deleteMany({ chatId });

    // Emit socket event to participants
    io.to(chatId).emit("chatDeleted", { chatId });

    const otherUserId = chat.users.find(
      (id) => id.toString() !== userId.toString()
    );
    if (otherUserId) {
      const receiverSocketId = getRecieverSocketId(otherUserId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("chatDeleted", { chatId });
      }
    }

    res.json({
      message: "Chat deleted successfully",
    });
  }
);
