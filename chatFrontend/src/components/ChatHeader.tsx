import { User } from "@/context/AppContext";
import { Menu, UserCircle, Phone, Video, Trash2, Users } from "lucide-react";
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
  const isOnlineUser = user && !user.isGroup && onlineUsers.includes(user._id);
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
          className="p-2.5 bg-[#202c33] rounded-full hover:bg-[#2a3942] transition-colors border border-gray-750"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5 text-gray-200" />
        </button>
      </div>

      {/* chat header */}
      <div className="w-full bg-[#202c33] border-b border-[#2a3942] px-6 py-3 flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {user ? (
            <>
              <div 
                onClick={onHeaderClick}
                className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer hover:bg-[#2a3942]/30 p-1.5 -m-1.5 rounded-lg transition-all"
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-10.5 h-10.5 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-650"
                  >
                    {user.profilePic?.url ? (
                      <img
                        src={user.profilePic.url}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : user.isGroup ? (
                      <Users className="w-6 h-6 text-gray-300" />
                    ) : (
                      <UserCircle className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  {/* online user setup */}
                  {isOnlineUser && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border border-[#202c33]">
                      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
                    </span>
                  )}
                </div>

                {/* user info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-white truncate leading-tight">
                    {user.name}
                  </h2>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isTyping ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-1 h-1 bg-green-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-1 h-1 bg-green-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <span className="text-green-400 font-medium">
                          typing...
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          isOnlineUser ? "text-green-400" : "text-gray-400"
                        }`}
                      >
                        {user.isGroup ? (
                          user.about || "Group Conversation"
                        ) : isOnlineUser ? (
                          "Online"
                        ) : (
                          user.showLastSeen !== false && user.lastSeen ? (
                            `Last seen ${moment(user.lastSeen).fromNow()}`
                          ) : (
                            "Offline"
                          )
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* call action buttons */}
              <div className="flex items-center gap-1.5">
                {!user.isGroup && (
                  <>
                    <button
                      onClick={() => callUser(user._id, "voice")}
                      className="p-2 hover:bg-[#2a3942]/60 text-gray-300 hover:text-white rounded-full transition-colors"
                      title="Voice Call"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => callUser(user._id, "video")}
                      className="p-2 hover:bg-[#2a3942]/60 text-gray-300 hover:text-white rounded-full transition-colors"
                      title="Video Call"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button
                  onClick={handleConfirmDelete}
                  className="p-2 hover:bg-red-950/40 hover:text-red-400 text-gray-400 rounded-full transition-colors"
                  title="Delete Chat"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10.5 h-10.5 rounded-full bg-gray-800 flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-400">
                  Select a conversation
                </h2>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatHeader;
