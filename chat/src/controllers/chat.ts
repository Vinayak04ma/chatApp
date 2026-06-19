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
      const unseenCount = await Messages.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        seen: false,
      });

      if (chat.isGroup) {
        return {
          user: {
            _id: chat._id,
            name: chat.groupName || "Group Chat",
            profilePic: chat.groupPic || null,
            email: "",
            about: chat.groupDescription || "Group conversation",
            isGroup: true,
          },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      }

      const otherUserId = chat.users.find((id) => id !== userId);

      try {
        const userData = await fetchUserWithCache(otherUserId!);

        return {
          user: userData || { _id: otherUserId, name: "Unknown User" },
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

  const hasMetaAIChat = chatWithUserData.some(c => ((c.chat as any)?._id || "").toString() === "66d0000000000000000000a1");
  if (!hasMetaAIChat) {
    const lastAiMessage = await Messages.findOne({ chatId: "66d0000000000000000000a1" }).sort({ createdAt: -1 });
    chatWithUserData.unshift({
      user: {
        _id: "66d0000000000000000000a2",
        name: "Meta AI",
        username: "meta.ai",
        about: "Meta AI assistant. Type anything to start talking!",
        profilePic: {
          url: "https://upload.wikimedia.org/wikipedia/commons/0/05/Meta_AI_logo.svg",
          publicId: "",
        },
        email: "meta-ai@chatify.com",
        isGroup: false,
        showLastSeen: false,
      },
      chat: {
        _id: "66d0000000000000000000a1" as any,
        users: [userId, "66d0000000000000000000a2"] as any,
        latestMessage: lastAiMessage ? {
          text: lastAiMessage.text || "",
          sender: lastAiMessage.sender.toString(),
        } : {
          text: "Ask Meta AI anything...",
          sender: "66d0000000000000000000a2"
        },
        createdAt: new Date(),
        updatedAt: lastAiMessage ? lastAiMessage.createdAt : new Date(0),
        unseenCount: 0,
      } as any
    });
  }

  // Sort chats by updatedAt descending so Meta AI behaves dynamically like normal chats
  chatWithUserData.sort((a, b) => new Date(b.chat.updatedAt).getTime() - new Date(a.chat.updatedAt).getTime());

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

  let chat;
  if (chatId === "66d0000000000000000000a1") {
    // Save user's message
    const userMessage = await Messages.create({
      chatId,
      sender: senderId,
      text: text || "Sent media",
      messageType: "text",
      seen: true,
      seenAt: new Date()
    });

    res.status(201).json({
      message: userMessage,
    });

    // Handle AI chatbot response in background
    (async () => {
      const userSocket = getRecieverSocketId(senderId.toString());
      if (userSocket) {
        io.to(userSocket).emit("userTyping", {
          chatId: "66d0000000000000000000a1",
          userId: "66d0000000000000000000a2",
        });
      }

      // Add a slight delay to simulate typing human feel
      await new Promise(resolve => setTimeout(resolve, 1500));

      let aiResponseText = "";
      const geminiKey = process.env.GEMINI_API_KEY;

      if (geminiKey) {
        try {
          const previousMessages = await Messages.find({ chatId: "66d0000000000000000000a1" })
            .sort({ createdAt: 1 })
            .limit(10);

          const contents: { role: string; parts: { text: string }[] }[] = [];
          for (const msg of previousMessages) {
            const role = msg.sender.toString() === senderId.toString() ? "user" : "model";
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
              contents[contents.length - 1].parts[0].text += "\n" + (msg.text || "");
            } else {
              contents.push({
                role,
                parts: [{ text: msg.text || "" }]
              });
            }
          }

          while (contents.length > 0 && contents[0].role !== "user") {
            contents.shift();
          }

          if (contents.length === 0) {
            contents.push({
              role: "user",
              parts: [{ text: text || "Hello" }]
            });
          }

          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            { contents }
          );

          aiResponseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
        } catch (error) {
          console.error("Gemini API error:", error);
          aiResponseText = "I encountered an error while processing your request. Please try again.";
        }
      } else {
        aiResponseText = `Hello! I'm Meta AI. I received your message: "${text || "media"}".\n\nTo activate my full AI brain, please add the \`GEMINI_API_KEY\` to your \`chat/.env\` file. You can grab a free key in 10 seconds from Google AI Studio.`;
      }

      const aiMessage = await Messages.create({
        chatId: "66d0000000000000000000a1",
        sender: "66d0000000000000000000a2",
        text: aiResponseText,
        messageType: "text",
        seen: true,
        seenAt: new Date()
      });

      if (userSocket) {
        io.to(userSocket).emit("userStoppedTyping", {
          chatId: "66d0000000000000000000a1",
          userId: "66d0000000000000000000a2",
        });
        io.to(userSocket).emit("newMessage", aiMessage);
      }
    })();
    return;
  }

  chat = await Chat.findById(chatId);

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

  if (!chat.isGroup && !otherUserId) {
    res.status(401).json({
      message: "No other user",
    });
    return;
  }

  //socket setup
  let receiverSocketId: string | undefined = undefined;
  let isReceiverInChatRoom = false;

  if (!chat.isGroup && otherUserId) {
    receiverSocketId = getRecieverSocketId(otherUserId.toString());
    if (receiverSocketId) {
      const receiverSocket = io.sockets.sockets.get(receiverSocketId);
      if (receiverSocket && receiverSocket.rooms.has(chatId)) {
        isReceiverInChatRoom = true;
      }
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

  if (chat.isGroup) {
    // Notify all participants
    chat.users.forEach((pId) => {
      if (pId.toString() !== senderId.toString()) {
        const pSocketId = getRecieverSocketId(pId.toString());
        if (pSocketId) {
          io.to(pSocketId).emit("newMessage", savedMessage);
        }
      }
    });
  } else {
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", savedMessage);
    }

    const senderSocketId = getRecieverSocketId(senderId.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", savedMessage);
    }

    if (isReceiverInChatRoom && senderSocketId && otherUserId) {
      io.to(senderSocketId).emit("messagesSeen", {
        chatId: chatId,
        seenBy: otherUserId,
        messageIds: [savedMessage._id],
      });
    }
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

    if (chatId === "66d0000000000000000000a1") {
      const messages = await Messages.find({ chatId }).sort({ createdAt: 1 });
      if (messages.length === 0) {
        const welcomeMessage = {
          _id: "66d0000000000000000000a3",
          chatId: "66d0000000000000000000a1",
          sender: "66d0000000000000000000a2",
          text: "Hello! I'm Meta AI. How can I help you today? You can ask me any questions or type a prompt to get started!",
          messageType: "text",
          seen: true,
          createdAt: new Date().toISOString(),
        };
        res.json({
          messages: [welcomeMessage],
          user: {
            _id: "66d0000000000000000000a2",
            name: "Meta AI",
            username: "meta.ai",
            about: "Meta AI assistant. Type anything to start talking!",
            profilePic: {
              url: "https://upload.wikimedia.org/wikipedia/commons/0/05/Meta_AI_logo.svg",
              publicId: "",
            },
            email: "meta-ai@chatify.com",
            isGroup: false,
            showLastSeen: false,
          },
        });
        return;
      }

      res.json({
        messages,
        user: {
          _id: "66d0000000000000000000a2",
          name: "Meta AI",
          username: "meta.ai",
          about: "Meta AI assistant. Type anything to start talking!",
          profilePic: {
            url: "https://upload.wikimedia.org/wikipedia/commons/0/05/Meta_AI_logo.svg",
            publicId: "",
          },
          email: "meta-ai@chatify.com",
          isGroup: false,
          showLastSeen: false,
        },
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

    if (chat.isGroup) {
      res.json({
        messages,
        user: {
          _id: chat._id,
          name: chat.groupName || "Group Chat",
          profilePic: chat.groupPic || null,
          email: "",
          about: chat.groupDescription || "Group conversation",
          isGroup: true,
        },
      });
      return;
    }

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

    if (chatId === "66d0000000000000000000a1") {
      await Messages.deleteMany({ chatId });
      res.json({
        message: "Chat deleted successfully",
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

    chat.users.forEach((pId) => {
      if (pId.toString() !== userId.toString()) {
        const receiverSocketId = getRecieverSocketId(pId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("chatDeleted", { chatId });
        }
      }
    });

    res.json({
      message: "Chat deleted successfully",
    });
  }
);

export const createGroupChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { groupName, groupDescription, participants } = req.body;

    if (!groupName || groupName.trim() === "") {
      res.status(400).json({
        message: "Group name is required",
      });
      return;
    }

    // Try parsing participants if it came as a JSON string
    let parsedParticipants = participants;
    if (typeof participants === "string") {
      try {
        parsedParticipants = JSON.parse(participants);
      } catch (err) {
        parsedParticipants = participants.split(",").map((s: string) => s.trim());
      }
    }

    if (!parsedParticipants || !Array.isArray(parsedParticipants) || parsedParticipants.length === 0) {
      res.status(400).json({
        message: "At least one participant is required",
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    // Include the creator in the participants array
    const uniqueParticipants = Array.from(
      new Set([userId.toString(), ...parsedParticipants.map((id: any) => id.toString())])
    );

    let groupPic = undefined;
    if (req.file) {
      groupPic = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    const newGroup = await Chat.create({
      users: uniqueParticipants,
      isGroup: true,
      groupName: groupName.trim(),
      groupDescription: groupDescription ? groupDescription.trim() : "",
      groupAdmin: userId.toString(),
      groupPic,
    });

    // Notify all participants
    uniqueParticipants.forEach((pId) => {
      const pSocketId = getRecieverSocketId(pId);
      if (pSocketId) {
        io.to(pSocketId).emit("newGroupCreated", newGroup);
      }
    });

    res.status(201).json({
      message: "Group Chat created successfully",
      chatId: newGroup._id,
      chat: newGroup,
    });
  }
);

export const getChatDetails = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    const isUserInChat = chat.users.some(
      (id) => id.toString() === userId.toString()
    );

    if (!isUserInChat) {
      res.status(403).json({ message: "You are not a participant of this chat" });
      return;
    }

    // Fetch details for all users in the chat
    const membersData = await Promise.all(
      chat.users.map(async (memberId) => {
        try {
          const userData = await fetchUserWithCache(memberId);
          return userData;
        } catch (error) {
          return { _id: memberId, name: "Unknown User" };
        }
      })
    );

    res.json({
      chat,
      members: membersData,
    });
  }
);
