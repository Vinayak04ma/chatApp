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
  if (userId === "66d0000000000000000000a2") {
    return {
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
    };
  }

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

  // Find or create the Meta AI chat for this user
  let metaAiChat = await Chat.findOne({
    isGroup: false,
    users: { $all: [userId.toString(), "66d0000000000000000000a2"] }
  });
  if (!metaAiChat) {
    metaAiChat = await Chat.create({
      users: [userId.toString(), "66d0000000000000000000a2"],
      isGroup: false,
      groupName: "",
      groupDescription: "",
      groupPic: undefined,
    });
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
      const isMetaAI = otherUserId === "66d0000000000000000000a2";

      try {
        const userData = await fetchUserWithCache(otherUserId!);

        return {
          user: userData || { _id: otherUserId, name: "Unknown User" },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || (isMetaAI ? {
              text: "Ask Meta AI anything...",
              sender: "66d0000000000000000000a2",
            } : null),
            unseenCount,
          },
        };
      } catch (error) {
        console.log(error);
        return {
          user: { _id: otherUserId, name: "Unknown User" },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || (isMetaAI ? {
              text: "Ask Meta AI anything...",
              sender: "66d0000000000000000000a2",
            } : null),
            unseenCount,
          },
        };
      }
    })
  );

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

  let chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404).json({
      message: "Chat not found",
    });
    return;
  }

  const isMetaAI = chat.users.some(id => id.toString() === "66d0000000000000000000a2");

  if (isMetaAI) {
    // Save user's message
    const userMessage = await Messages.create({
      chatId,
      sender: senderId,
      text: text || "Sent media",
      messageType: "text",
      seen: true,
      seenAt: new Date()
    });

    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: {
        text: text || "Sent media",
        sender: senderId,
      },
      updatedAt: new Date()
    });

    res.status(201).json({
      message: userMessage,
    });

    // Handle AI chatbot response in background
    (async () => {
      const userSocket = getRecieverSocketId(senderId.toString());
      if (userSocket) {
        io.to(userSocket).emit("userTyping", {
          chatId,
          userId: "66d0000000000000000000a2",
        });
      }

      // Add a slight delay to simulate typing human feel
      await new Promise(resolve => setTimeout(resolve, 1500));

      let aiResponseText = "";
      const geminiKey = process.env.GEMINI_API_KEY;

      if (geminiKey) {
        try {
          const previousMessages = await Messages.find({ chatId })
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

          const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-pro-latest"
          ];
          
          let lastErrorMessage = "";
          for (const model of modelsToTry) {
            try {
              const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
                { contents }
              );
              
              if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                aiResponseText = response.data.candidates[0].content.parts[0].text;
                break;
              }
            } catch (error: any) {
              const errMsg = error.response?.data?.error?.message || error.message;
              console.error(`Gemini API error for model ${model}:`, errMsg);
              lastErrorMessage = errMsg;
            }
          }

          if (!aiResponseText) {
            aiResponseText = `I encountered an error while processing your request: "${lastErrorMessage}". Please try again.`;
          }
        } catch (error: any) {
          console.error("Gemini context/history processing error:", error);
          aiResponseText = `I encountered an error while processing your request: "${error.message}". Please try again.`;
        }
      } else {
        aiResponseText = `Hello! I'm Meta AI. I received your message: "${text || "media"}".\n\nTo activate my full AI brain, please add the \`GEMINI_API_KEY\` to your \`chat/.env\` file. You can grab a free key in 10 seconds from Google AI Studio.`;
      }

      const aiMessage = await Messages.create({
        chatId,
        sender: "66d0000000000000000000a2",
        text: aiResponseText,
        messageType: "text",
        seen: true,
        seenAt: new Date()
      });

      await Chat.findByIdAndUpdate(chatId, {
        latestMessage: {
          text: aiResponseText,
          sender: "66d0000000000000000000a2",
        },
        updatedAt: new Date()
      });

      if (userSocket) {
        io.to(userSocket).emit("userStoppedTyping", {
          chatId,
          userId: "66d0000000000000000000a2",
        });
        io.to(userSocket).emit("newMessage", aiMessage);
      }
    })();
    return;
  }

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

    const isMetaAI = chat.users.some(id => id.toString() === "66d0000000000000000000a2");

    if (isMetaAI && messages.length === 0) {
      const welcomeMessage = {
        _id: "66d0000000000000000000a3",
        chatId: chatId,
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

    if (chat.isGroup) {
      const participantsData = await Promise.all(
        chat.users.map(async (pId) => {
          try {
            const uData = await fetchUserWithCache(pId.toString());
            return uData || { _id: pId.toString(), name: "Unknown User" };
          } catch (err) {
            return { _id: pId.toString(), name: "Unknown User" };
          }
        })
      );

      res.json({
        messages,
        user: {
          _id: chat._id,
          name: chat.groupName || "Group Chat",
          profilePic: chat.groupPic || null,
          email: "",
          about: chat.groupDescription || "Group conversation",
          isGroup: true,
          groupAdmin: chat.groupAdmin || "",
          participants: participantsData,
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

export const logCall = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { chatId, callType, status, duration } = req.body;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!chatId || !callType || !status) {
    res.status(400).json({ message: "chatId, callType, and status are required" });
    return;
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404).json({ message: "Chat not found" });
    return;
  }

  const textPayload = JSON.stringify({
    callType, // "voice" | "video"
    status, // "missed" | "completed" | "declined"
    duration: duration || 0,
  });

  const callMessage = await Messages.create({
    chatId,
    sender: userId,
    text: textPayload,
    messageType: "call",
    seen: false,
  });

  chat.latestMessage = {
    text: status === "missed" ? `Missed ${callType} call` : `${callType === "video" ? "Video" : "Voice"} call`,
    sender: userId,
  } as any;

  await chat.save();

  // Notify other users in the chat via socket
  chat.users.forEach((uId) => {
    if (uId.toString() !== userId.toString()) {
      const socketId = getRecieverSocketId(uId.toString());
      if (socketId) {
        io.to(socketId).emit("newMessage", callMessage);
      }
    }
  });

  res.status(201).json({
    message: "Call logged successfully",
    callMessage,
  });
});

export const getCallHistory = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // Find all chats user is part of
  const chats = await Chat.find({ users: userId });
  const chatIds = chats.map((c) => c._id);

  // Find all call messages in those chats
  const callMessages = await Messages.find({
    chatId: { $in: chatIds },
    messageType: "call",
  }).sort({ createdAt: -1 });

  // Map call messages to include populated other-user info and chat details
  const populatedHistory = await Promise.all(
    callMessages.map(async (msg) => {
      const parentChat = chats.find((c: any) => c._id.toString() === msg.chatId.toString());
      const otherUserId = parentChat?.users.find((id: any) => id.toString() !== userId.toString());
      
      let otherUser = { _id: otherUserId, name: "Unknown User" };
      if (otherUserId) {
        try {
          otherUser = await fetchUserWithCache(otherUserId.toString());
        } catch (err) {}
      }

      return {
        _id: msg._id,
        chatId: msg.chatId,
        sender: msg.sender,
        text: msg.text,
        messageType: msg.messageType,
        createdAt: msg.createdAt,
        user: otherUser,
      };
    })
  );

  res.json({
    history: populatedHistory,
  });
});
