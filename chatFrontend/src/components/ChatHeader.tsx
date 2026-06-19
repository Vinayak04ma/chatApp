import { User } from "@/context/AppContext";
import { Menu, UserCircle, Phone, Video, Trash2 } from "lucide-react";
import React from "react";
import { CallData } from "@/context/CallContext";
import moment from "moment";

interface ChatHeaderProps {
  user: User | null;
  setSidebarOpen: (open: boolean) => void;
  isTyping: boolean;
  onlineUsers: string[];
  onHeaderClick?: () => void;
  onDeleteChat?: () => void;
}

const ChatHeader = ({
  user,
  setSidebarOpen,
  isTyping,
  onlineUsers,
  onHeaderClick,
  onDeleteChat,
}: ChatHeaderProps) => {
  const isOnlineUser = user && onlineUsers.includes(user._id);
  const { callUser } = CallData();

  const handleConfirmDelete = () => {
    if (confirm("Are you sure you want to delete this chat and all its messages? This action cannot be undone.")) {
      if (onDeleteChat) onDeleteChat();
    }
  };

  return (
    <>
      {/* mobile menu toggle */}
      <div className="sm:hidden fixed top-4 right-4 z-30">
        <button
          className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5 text-gray-200" />
        </button>
      </div>

      {/* chat header */}
      <div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between gap-4">
          {user ? (
            <>
              <div 
                onClick={onHeaderClick}
                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer hover:bg-gray-700/40 p-2 -m-2 rounded-lg transition-all"
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-600"
                  >
                    {user.profilePic?.url ? (
                      <img
                        src={user.profilePic.url}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  {/* online user setup */}
                  {isOnlineUser && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-gray-800">
                      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
                    </span>
                  )}
                </div>

                {/* user info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-white truncate">
                      {user.name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTyping ? (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <span className="text-blue-500 font-medium">
                          typing...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isOnlineUser ? "bg-green-500" : "bg-gray-500"
                          }`}
                        ></div>
                        <span
                          className={`text-sm font-medium ${
                            isOnlineUser ? "text-green-500" : "text-gray-400"
                          }`}
                        >
                          {isOnlineUser ? (
                            "Online"
                          ) : (
                            user.showLastSeen !== false && user.lastSeen ? (
                              `Last seen ${moment(user.lastSeen).fromNow()}`
                            ) : (
                              "Offline"
                            )
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* call action buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => callUser(user._id, "voice")}
                  className="p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full transition-all hover:scale-105 active:scale-95 border border-gray-600/50"
                  title="Voice Call"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button
                  onClick={() => callUser(user._id, "video")}
                  className="p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full transition-all hover:scale-105 active:scale-95 border border-gray-600/50"
                  title="Video Call"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="p-3 bg-gray-700 hover:bg-red-600/80 text-gray-300 hover:text-white rounded-full transition-all hover:scale-105 active:scale-95 border border-gray-600/50"
                  title="Delete Chat"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-gray-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-400">
                  Select a conversation
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a chat from the sidebar to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatHeader;
