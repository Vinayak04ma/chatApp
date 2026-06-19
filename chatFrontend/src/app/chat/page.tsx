"use client";
import React, { useState } from "react";
import ChatSidebar from "@/components/ChatSidebar";
import Loading from "@/components/Loading";
import ChatHeader from "@/components/ChatHeader";
import ChatMessages from "@/components/ChatMessages";
import MessageInput from "@/components/MessageInput";
import OnboardingSetup from "@/components/OnboardingSetup";
import { useChatState } from "@/hooks/useChatState";
import { X, UserCircle, Phone, Video } from "lucide-react";
import { CallData } from "@/context/CallContext";

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
    handleDeleteMessage,
    handleEditMessage,
    handleDeleteChat,
  } = useChatState();

  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const { callUser } = CallData();

  const sharedMedia = React.useMemo(() => {
    if (!messages) return [];
    return messages.filter(
      (msg) => msg.messageType === "image" && msg.image?.url
    );
  }, [messages]);

  if (loading) return <Loading />;

  if (loggedInUser && !loggedInUser.username) {
    return <OnboardingSetup loggedInUser={loggedInUser} />;
  }

  return (
    <div className="h-screen flex bg-[#0b141a] text-white relative overflow-hidden">
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
      <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
        {/* Subtle WhatsApp-like background pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"></div>
        
        <div className="relative flex-1 flex flex-col h-full z-10 overflow-hidden">
          <ChatHeader
            user={user}
            setSidebarOpen={setSiderbarOpen}
            isTyping={isTyping}
            onlineUsers={onlineUsers}
            onHeaderClick={() => setProfilePanelOpen(!profilePanelOpen)}
            onDeleteChat={() => handleDeleteChat(selectedUser!)}
          />

          <ChatMessages
            selectedUser={selectedUser}
            user={user}
            messages={messages}
            loggedInUser={loggedInUser}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
          />

          <MessageInput
            selectedUser={selectedUser}
            message={message}
            setMessage={handleTyping}
            handleMessageSend={handleMessageSend}
          />
        </div>
      </div>

      {/* WhatsApp-style Profile Info Sidebar */}
      {profilePanelOpen && user && (
        <div className="w-80 h-screen overflow-y-auto bg-[#111b21] border-l border-gray-800 p-6 flex flex-col gap-6 relative animate-in slide-in-from-right duration-300 z-40 custom-scroll pb-10">
          <button 
            onClick={() => setProfilePanelOpen(false)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center gap-4 text-center mt-8">
            <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700 shadow-lg overflow-hidden">
              {user.profilePic?.url ? (
                <img
                  src={user.profilePic.url}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle className="w-16 h-16 text-gray-300" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white truncate max-w-[240px]">{user.name}</h3>
              <p className="text-sm text-gray-400 truncate max-w-[240px]">{user.email}</p>
            </div>
          </div>
          
          {user._id !== "66d0000000000000000000a2" && (
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-sm font-semibold text-gray-400 mb-4">Call Options</h4>
              <div className="flex justify-around">
                <button 
                  onClick={() => callUser(user._id, "voice")}
                  className="flex flex-col items-center gap-2 text-gray-300 hover:text-white group"
                >
                  <div className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-transform group-hover:scale-110">
                    <Phone className="w-5 h-5" />
                  </div>
                  <span className="text-xs">Voice</span>
                </button>
                <button 
                  onClick={() => callUser(user._id, "video")}
                  className="flex flex-col items-center gap-2 text-gray-300 hover:text-white group"
                >
                  <div className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-transform group-hover:scale-110">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-xs">Video</span>
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-gray-700 pt-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">About</h4>
            <div className="text-sm text-gray-300 bg-gray-900/40 p-3 rounded-lg border border-gray-700/50">
              <p className="italic">"{user.about || "Hey there! I am using Chatify."}"</p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Media, Links & Docs</h4>
            {sharedMedia.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {sharedMedia.map((msg, index) => (
                  <a 
                    key={index}
                    href={msg.image?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-900 border border-gray-700 hover:opacity-80 transition-opacity"
                  >
                    <img 
                      src={msg.image?.url} 
                      alt="shared media" 
                      className="object-cover w-full h-full"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <div className="bg-gray-900/40 rounded-lg p-4 text-center text-sm text-gray-500 border border-gray-700/50">
                No media shared yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatApp;
