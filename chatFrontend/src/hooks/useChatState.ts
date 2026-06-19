import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import axios from "axios";
import { chat_service, useAppData, User } from "@/context/AppContext";
import { SocketData } from "@/context/SocketContext";

export interface Message {
  _id: string;
  chatId: string;
  sender: string;
  text?: string;
  image?: {
    url: string;
    publicId: string;
  };
  audio?: {
    url: string;
    publicId: string;
  };
  messageType: "text" | "image" | "audio";
  seen: boolean;
  seenAt?: string;
  createdAt: string;
  isSending?: boolean;
}

export function useChatState() {
  const {
    loading,
    isAuth,
    logoutUser,
    chats,
    user: loggedInUser,
    users,
    fetchChats,
    setChats,
  } = useAppData();

  const { onlineUsers, socket } = SocketData();

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [siderbarOpen, setSiderbarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showAllUser, setShowAllUser] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeOut, setTypingTimeOut] = useState<NodeJS.Timeout | null>(
    null
  );

  const router = useRouter();

  useEffect(() => {
    if (!isAuth && !loading) {
      router.push("/login");
    }
  }, [isAuth, router, loading]);

  const handleLogout = () => logoutUser();

  async function fetchChat() {
    const token = Cookies.get("token");
    try {
      const { data } = await axios.get(
        `${chat_service}/api/v1/message/${selectedUser}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessages(data.messages);
      setUser(data.user);
      await fetchChats();
    } catch (error) {
      console.log(error);
      toast.error("Failed to load messages");
    }
  }

  const moveChatToTop = (
    chatId: string,
    newMessage: any,
    updatedUnseenCount = true
  ) => {
    setChats((prev) => {
      if (!prev) return null;

      const updatedChats = [...prev];
      const chatIndex = updatedChats.findIndex(
        (chat) => chat.chat._id === chatId
      );

      if (chatIndex !== -1) {
        const [moveChat] = updatedChats.splice(chatIndex, 1);

        const updatedChat = {
          ...moveChat,
          chat: {
            ...moveChat.chat,
            latestMessage: {
              text: newMessage.text,
              sender: newMessage.sender,
            },
            updatedAt: new Date().toString(),

            unseenCount:
              updatedUnseenCount && newMessage.sender !== loggedInUser?._id
                ? (moveChat.chat.unseenCount || 0) + 1
                : moveChat.chat.unseenCount || 0,
          },
        };

        updatedChats.unshift(updatedChat);
      }

      return updatedChats;
    });
  };

  const resetUnseenCount = (chatId: string) => {
    setChats((prev) => {
      if (!prev) return null;

      return prev.map((chat) => {
        if (chat.chat._id === chatId) {
          return {
            ...chat,
            chat: {
              ...chat.chat,
              unseenCount: 0,
            },
          };
        }
        return chat;
      });
    });
  };

  async function createChat(u: User) {
    try {
      const token = Cookies.get("token");
      const { data } = await axios.post(
        `${chat_service}/api/v1/chat/new`,
        {
          userId: loggedInUser?._id,
          otherUserId: u._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSelectedUser(data.chatId);
      setShowAllUser(false);
      await fetchChats();
    } catch (error) {
      toast.error("Failed to start chat");
    }
  }

  const handleMessageSend = async (
    e: any,
    imageFile?: File | null,
    audioFile?: File | null
  ) => {
    e.preventDefault();

    if (!message.trim() && !imageFile && !audioFile) return;

    if (!selectedUser) return;

    // Create a temporary message for optimistic UI
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      _id: tempId,
      chatId: selectedUser,
      sender: loggedInUser?._id || "",
      text: message,
      messageType: audioFile ? "audio" : imageFile ? "image" : "text",
      seen: false,
      createdAt: new Date().toISOString(),
      image: imageFile ? { url: URL.createObjectURL(imageFile), publicId: "" } : undefined,
      audio: audioFile ? { url: URL.createObjectURL(audioFile), publicId: "" } : undefined,
      isSending: true,
    };

    // Add temp message to UI instantly
    setMessages((prev) => [...(prev || []), tempMessage]);

    // Move chat to top in sidebar instantly
    const displayText = imageFile ? "📷 image" : audioFile ? "🎵 voice message" : message;
    moveChatToTop(selectedUser, { text: displayText, sender: loggedInUser?._id }, false);

    // Clear input state immediately
    setMessage("");

    // socket work
    if (typingTimeOut) {
      clearTimeout(typingTimeOut);
      setTypingTimeOut(null);
    }

    socket?.emit("stopTyping", {
      chatId: selectedUser,
      userId: loggedInUser?._id,
    });

    const token = Cookies.get("token");

    try {
      const formData = new FormData();
      formData.append("chatId", selectedUser);

      if (message.trim()) {
        formData.append("text", message);
      }
      if (imageFile) {
        formData.append("image", imageFile);
      }
      if (audioFile) {
        formData.append("audio", audioFile);
      }

      const { data } = await axios.post(
        `${chat_service}/api/v1/message`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Replace temp message with server message
      setMessages((prev) => {
        if (!prev) return [data.message];
        return prev.map((msg) => (msg._id === tempId ? data.message : msg));
      });

      moveChatToTop(
        selectedUser!,
        {
          text: displayText,
          sender: data.message.sender,
        },
        false
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send message");
      // Remove the temp message if upload failed
      setMessages((prev) => {
        if (!prev) return null;
        return prev.filter((msg) => msg._id !== tempId);
      });
    }
  };

  const handleTyping = (value: string) => {
    setMessage(value);

    if (!selectedUser || !socket) return;

    // socket setup
    if (value.trim()) {
      socket.emit("typing", {
        chatId: selectedUser,
        userId: loggedInUser?._id,
      });
    }

    if (typingTimeOut) {
      clearTimeout(typingTimeOut);
    }

    const timeout = setTimeout(() => {
      socket.emit("stopTyping", {
        chatId: selectedUser,
        userId: loggedInUser?._id,
      });
    }, 2000);

    setTypingTimeOut(timeout);
  };

  useEffect(() => {
    socket?.on("newMessage", (message) => {
      console.log("Recieved new message:", message);

      if (selectedUser === message.chatId) {
        const isFromOtherUser = message.sender !== loggedInUser?._id;
        const finalMessage = isFromOtherUser
          ? { ...message, seen: true, seenAt: new Date().toISOString() }
          : message;

        if (isFromOtherUser) {
          socket?.emit("messageSeen", {
            chatId: selectedUser,
            messageIds: [message._id],
            userId: loggedInUser?._id,
          });
        }

        setMessages((prev) => {
          const currentMessages = prev || [];
          const messageExists = currentMessages.some(
            (msg) => msg._id === message._id
          );

          if (!messageExists) {
            return [...currentMessages, finalMessage];
          }
          return currentMessages.map((msg) =>
            msg._id === message._id ? finalMessage : msg
          );
        });

        moveChatToTop(message.chatId, finalMessage, false);
      } else {
        moveChatToTop(message.chatId, message, true);
      }
    });

    socket?.on("messagesSeen", (data) => {
      console.log("Message seen by:", data);

      if (selectedUser === data.chatId) {
        setMessages((prev) => {
          if (!prev) return null;
          return prev.map((msg) => {
            if (
              msg.sender === loggedInUser?._id &&
              data.messageIds &&
              data.messageIds.includes(msg._id)
            ) {
              return {
                ...msg,
                seen: true,
                seenAt: new Date().toString(),
              };
            } else if (msg.sender === loggedInUser?._id && !data.messageIds) {
              return {
                ...msg,
                seen: true,
                seenAt: new Date().toString(),
              };
            }
            return msg;
          });
        });
      }
    });

    socket?.on("userTyping", (data) => {
      console.log("recieved user typing", data);
      if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) {
        setIsTyping(true);
      }
    });

    socket?.on("userStoppedTyping", (data) => {
      console.log("recieved user stopped typing", data);
      if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) {
        setIsTyping(false);
      }
    });

    socket?.on("messageDeleted", (data) => {
      console.log("Message deleted:", data);
      if (selectedUser === data.chatId) {
        setMessages((prev) => {
          if (!prev) return null;
          return prev.filter((msg) => msg._id !== data.messageId);
        });
      }
      fetchChats();
    });

    socket?.on("messageEdited", (data) => {
      console.log("Message edited:", data);
      if (selectedUser === data.chatId) {
        setMessages((prev) => {
          if (!prev) return null;
          return prev.map((msg) =>
            msg._id === data._id ? { ...msg, text: data.text } : msg
          );
        });
      }
      fetchChats();
    });

    socket?.on("chatDeleted", (data) => {
      console.log("Chat deleted:", data);
      if (selectedUser === data.chatId) {
        setSelectedUser(null);
        setMessages(null);
      }
      fetchChats();
    });

    socket?.on("userStatusChanged", (data) => {
      console.log("User status changed:", data);
      setUser((prev) => {
        if (prev && prev._id === data.userId) {
          return {
            ...prev,
            lastSeen: data.isOnline ? undefined : data.lastSeen,
          };
        }
        return prev;
      });
    });

    return () => {
      socket?.off("newMessage");
      socket?.off("messagesSeen");
      socket?.off("userTyping");
      socket?.off("userStoppedTyping");
      socket?.off("messageDeleted");
      socket?.off("messageEdited");
      socket?.off("chatDeleted");
      socket?.off("userStatusChanged");
    };
  }, [socket, selectedUser, setChats, loggedInUser?._id]);

  useEffect(() => {
    if (selectedUser) {
      fetchChat();
      setIsTyping(false);

      resetUnseenCount(selectedUser);

      socket?.emit("joinChat", selectedUser);

      return () => {
        socket?.emit("leaveChat", selectedUser);
        setMessages(null);
      };
    }
  }, [selectedUser, socket]);

  useEffect(() => {
    return () => {
      if (typingTimeOut) {
        clearTimeout(typingTimeOut);
      }
    };
  }, [typingTimeOut]);

  const handleDeleteMessage = async (messageId: string) => {
    const token = Cookies.get("token");
    try {
      await axios.delete(`${chat_service}/api/v1/message/${messageId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages((prev) => {
        if (!prev) return null;
        return prev.filter((msg) => msg._id !== messageId);
      });
      toast.success("Message deleted");
      fetchChats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!newText.trim()) return;
    const token = Cookies.get("token");
    try {
      await axios.put(
        `${chat_service}/api/v1/message/${messageId}`,
        { text: newText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setMessages((prev) => {
        if (!prev) return null;
        return prev.map((msg) =>
          msg._id === messageId ? { ...msg, text: newText } : msg
        );
      });
      toast.success("Message updated");
      fetchChats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to edit message");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    const token = Cookies.get("token");
    try {
      await axios.delete(`${chat_service}/api/v1/chat/${chatId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSelectedUser(null);
      setMessages(null);
      toast.success("Chat deleted");
      fetchChats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete chat");
    }
  };

  return {
    loading,
    siderbarOpen,
    setSiderbarOpen,
    showAllUser,
    setShowAllUser,
    users,
    loggedInUser,
    chats,
    selectedUser,
    setSelectedUser,
    handleLogout,
    createChat,
    onlineUsers,
    user,
    isTyping,
    messages,
    message,
    handleTyping,
    handleMessageSend,
    handleDeleteMessage,
    handleEditMessage,
    handleDeleteChat,
  };
}
