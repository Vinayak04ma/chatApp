"use client";
import React from "react";
import ChatSidebar from "@/components/ChatSidebar";
import Loading from "@/components/Loading";
import ChatHeader from "@/components/ChatHeader";
import ChatMessages from "@/components/ChatMessages";
import MessageInput from "@/components/MessageInput";
import { useChatState } from "@/hooks/useChatState";

export type { Message } from "@/hooks/useChatState";

const ChatApp = () => {
  const {
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
  } = useChatState();

  if (loading) return <Loading />;
  return (
    <div className="min-h-screen flex bg-gray-900 text-white relative overflow-hidden">
      <ChatSidebar
        sidebarOpen={siderbarOpen}
        setSidebarOpen={setSiderbarOpen}
        showAllUsers={showAllUser}
        setShowAllUsers={setShowAllUser}
        users={users}
        loggedInUser={loggedInUser}
        chats={chats}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        handleLogout={handleLogout}
        createChat={createChat}
        onlineUsers={onlineUsers}
      />
      <div className="flex-1 flex flex-col justify-between p-4 backdrop-blur-xl bg-white/5 border-1 border-white/10">
        <ChatHeader
          user={user}
          setSidebarOpen={setSiderbarOpen}
          isTyping={isTyping}
          onlineUsers={onlineUsers}
        />

        <ChatMessages
          selectedUser={selectedUser}
          messages={messages}
          loggedInUser={loggedInUser}
        />

        <MessageInput
          selectedUser={selectedUser}
          message={message}
          setMessage={handleTyping}
          handleMessageSend={handleMessageSend}
        />
      </div>
    </div>
  );
};

export default ChatApp;
