import { User } from "@/context/AppContext";
import {
  CornerDownRight,
  CornerUpLeft,
  Divide,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  UserCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

interface ChatSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  showAllUsers: boolean;
  setShowAllUsers: (show: boolean | ((prev: boolean) => boolean)) => void;
  users: User[] | null;
  loggedInUser: User | null;
  chats: any[] | null;
  selectedUser: string | null;
  setSelectedUser: (userId: string | null) => void;
  handleLogout: () => void;
  createChat: (user: User) => void;
  onlineUsers: string[];
}

const ChatSidebar = ({
  sidebarOpen,
  setShowAllUsers,
  setSidebarOpen,
  showAllUsers,
  users,
  loggedInUser,
  chats,
  selectedUser,
  setSelectedUser,
  handleLogout,
  createChat,
  onlineUsers,
}: ChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <aside
      className={`fixed z-20 sm:static top-0 left-0 h-screen w-80 bg-[#111b21] border-r border-[#222e35] transform ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } sm:translate-x-0 transition-transform duration-300 flex flex-col`}
    >
      {/* header */}
      <div className="px-5 py-3.5 bg-[#202c33] border-b border-[#2a3942] flex flex-col gap-2 flex-shrink-0">
        {sidebarOpen && (
          <div className="sm:hidden flex justify-end">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-[#2a3942] rounded-full transition-colors text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              {showAllUsers ? "New Chat" : "Chats"}
            </h2>
          </div>

          <button
            className={`p-2 rounded-full transition-colors ${
              showAllUsers
                ? "bg-red-950/40 hover:bg-red-900/40 text-red-400"
                : "bg-green-950/40 hover:bg-green-900/40 text-green-400"
            }`}
            onClick={() => setShowAllUsers((prev) => !prev)}
          >
            {showAllUsers ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden px-2 py-3">
        {showAllUsers ? (
          <div className="space-y-4 h-full flex flex-col">
            <div className="relative px-2">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Users..."
                className="w-full pl-10 pr-4 py-2 bg-[#202c33] border border-transparent rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500/50 transition-colors text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* users list */}
            <div className="flex-1 overflow-y-auto space-y-1 custom-scroll pb-4 px-1">
              {users
                ?.filter(
                  (u) =>
                    u._id !== loggedInUser?._id &&
                    u.name
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                )
                .map((u) => (
                  <button
                    key={u._id}
                    className="w-full text-left p-3.5 rounded-lg hover:bg-[#202c33]/50 transition-colors border-b border-[#222e35]/35 flex items-center justify-between"
                    onClick={() => createChat(u)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-650">
                          {u.profilePic?.url ? (
                            <img
                              src={u.profilePic.url}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserCircle className="w-6 h-6 text-gray-300" />
                          )}
                        </div>
                        {onlineUsers.includes(u._id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border border-[#111b21] z-10" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-gray-200">{u.name}</span>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {onlineUsers.includes(u._id) ? "Online" : "Offline"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ) : chats && chats.length > 0 ? (
          <div className="overflow-y-auto h-full space-y-0.5 custom-scroll pb-4 px-1">
            {chats.map((chat) => {
              const latestMessage = chat.chat.latestMessage;
              const isSelected = selectedUser === chat.chat._id;
              const isSentByMe = latestMessage?.sender === loggedInUser?._id;
              const unseenCount = chat.chat.unseenCount || 0;

              return (
                <button
                  key={chat.chat._id}
                  onClick={() => {
                    setSelectedUser(chat.chat._id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-lg transition-colors border-b border-[#222e35]/25 relative flex items-center justify-between ${
                    isSelected
                      ? "bg-[#2a3942] text-white"
                      : "hover:bg-[#202c33]/50 text-gray-300"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-green-500 rounded-r-md" />
                  )}
                  
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-650">
                        {chat.user.profilePic?.url ? (
                          <img
                            src={chat.user.profilePic.url}
                            alt={chat.user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserCircle className="w-6 h-6 text-gray-300" />
                        )}
                      </div>
                      {onlineUsers.includes(chat.user._id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border border-[#111b21] z-10" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={`font-semibold text-sm truncate ${
                            isSelected ? "text-white" : "text-gray-200"
                          }`}
                        >
                          {chat.user.name}
                        </span>
                        {unseenCount > 0 && (
                          <div className="bg-green-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                            {unseenCount > 99 ? "99+" : unseenCount}
                          </div>
                        )}
                      </div>

                      {latestMessage ? (
                        <div className="flex items-center gap-1.5">
                          {isSentByMe ? (
                            <CornerUpLeft
                              size={12}
                              className="text-gray-400 flex-shrink-0"
                            />
                          ) : (
                            <CornerDownRight
                              size={12}
                              className="text-green-400 flex-shrink-0"
                            />
                          )}
                          <span className="text-xs text-gray-400 truncate flex-1">
                            {latestMessage.text}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No messages yet</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 mt-10">
            <div className="p-3 bg-[#202c33] rounded-full mb-3">
              <MessageCircle className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-400 font-medium text-sm">No conversation yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Start a new chat to begin messaging
            </p>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="p-3 bg-[#202c33] border-t border-[#2a3942] space-y-1.5 flex-shrink-0">
        <Link
          href={"/profile"}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2a3942]/65 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-650 flex-shrink-0">
            {loggedInUser?.profilePic?.url ? (
              <img
                src={loggedInUser.profilePic.url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserCircle className="w-5 h-5 text-gray-300" />
            )}
          </div>
          <span className="font-semibold text-sm text-gray-300">Profile Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-colors"
        >
          <div className="w-8 h-8 bg-red-950/50 hover:bg-red-900/50 rounded-full flex items-center justify-center flex-shrink-0">
            <LogOut className="w-4 h-4 text-red-400" />
          </div>
          <span className="font-semibold text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default ChatSidebar;
