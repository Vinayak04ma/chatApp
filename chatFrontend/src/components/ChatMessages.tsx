import { Message } from "@/app/chat/page";
import { User } from "@/context/AppContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Check, CheckCheck, Clock, Pencil, Trash2, X, MessageCircle } from "lucide-react";

interface ChatMessagesProps {
  selectedUser: string | null;
  messages: Message[] | null;
  loggedInUser: User | null;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
}

const ChatMessages = ({
  selectedUser,
  messages,
  loggedInUser,
  onDeleteMessage,
  onEditMessage,
}: ChatMessagesProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  //   seen feature
  const uniqueMessages = useMemo(() => {
    if (!messages) return [];
    const seen = new Set();
    return messages.filter((message) => {
      if (seen.has(message._id)) {
        return false;
      }
      seen.add(message._id);
      return true;
    });
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedUser, uniqueMessages]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-4 space-y-3 custom-scroll">
      {!selectedUser ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-20 select-none">
          <div className="p-4 bg-[#202c33] rounded-full mb-4">
            <MessageCircle className="w-12 h-12 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-200">Chatify</h3>
          <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
            Select a conversation to start messaging. Send texts, voice notes, or photos in real-time.
          </p>
        </div>
      ) : (
        <>
          {uniqueMessages.map((e, i) => {
            const isSentByMe = e.sender === loggedInUser?._id;
            const uniqueKey = `${e._id}-${i}`;

            return (
              <div
                className={`flex flex-col gap-1 mt-1.5 ${
                  isSentByMe ? "items-end" : "items-start"
                }`}
                key={uniqueKey}
              >
                <div className={`flex items-end gap-2 group max-w-[80%] sm:max-w-[70%] ${isSentByMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    className={`rounded-2xl transition-opacity duration-300 relative ${
                      isSentByMe
                        ? "bg-[#005c4b] text-gray-100 rounded-tr-none"
                        : "bg-[#202c33] text-gray-100 rounded-tl-none"
                    } ${e.isSending ? "opacity-60" : ""}`}
                  >
                    {editingMessageId === e._id ? (
                      <div className="flex flex-col gap-2 min-w-[220px] p-3">
                        <textarea
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          className="bg-[#111b21] text-white p-2 rounded border border-gray-700 focus:outline-none focus:border-green-500 text-sm resize-none w-full"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingMessageId(null)}
                            className="p-1 hover:bg-[#202c33] rounded text-red-400 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              onEditMessage(e._id, editingText);
                              setEditingMessageId(null);
                            }}
                            className="p-1 hover:bg-[#202c33] rounded text-green-400 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`relative ${e.messageType === "image" && e.image ? "p-1 pb-6" : "p-3 pb-6 pr-12"}`}>
                        {e.messageType === "image" && e.image && (
                          <div className="relative group overflow-hidden rounded-lg">
                            <img
                              src={e.image.url}
                              alt="shared image"
                              className="max-w-xs sm:max-w-sm h-auto rounded-lg object-cover"
                            />
                          </div>
                        )}

                        {e.messageType === "audio" && e.audio && (
                          <div className="relative group min-w-[240px] py-1 pr-6">
                            <audio
                              src={e.audio.url}
                              controls
                              className="max-w-full h-9 rounded filter invert opacity-90"
                            />
                          </div>
                        )}

                        {e.text && (
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text mt-0.5">
                            {e.text}
                          </p>
                        )}

                        {/* Floating bottom metadata */}
                        <div className={`absolute bottom-1 right-2 flex items-center gap-1 text-[10px] select-none ${
                          e.messageType === "image" && e.image
                            ? "bg-black/50 text-gray-300 px-1.5 py-0.5 rounded-full"
                            : "text-gray-400"
                        }`}>
                          <span>{moment(e.createdAt).format("hh:mm A")}</span>
                          {isSentByMe && (
                            <span className="flex items-center">
                              {e.isSending ? (
                                <Clock className="w-3 h-3 text-gray-400 animate-pulse" />
                              ) : e.seen ? (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons on hover */}
                  {isSentByMe && !e.isSending && editingMessageId !== e._id && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-200 self-center">
                      {e.messageType === "text" && (
                        <button
                          onClick={() => {
                            setEditingMessageId(e._id);
                            setEditingText(e.text || "");
                          }}
                          className="p-1.5 hover:bg-[#202c33] rounded-full text-gray-400 hover:text-green-400 transition-colors bg-[#111b21]/80 border border-gray-800"
                          title="Edit message"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm("Delete this message?")) {
                            onDeleteMessage(e._id);
                          }
                        }}
                        className="p-1.5 hover:bg-[#202c33] rounded-full text-gray-400 hover:text-red-400 transition-colors bg-[#111b21]/80 border border-gray-800"
                        title="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  );
};

export default ChatMessages;
