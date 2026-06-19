import { Message } from "@/app/chat/page";
import { User } from "@/context/AppContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Check, CheckCheck, Clock, Pencil, Trash2, X } from "lucide-react";

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
    <div className="flex-1 overflow-hidden">
      <div className="h-full max-h-[calc(100vh-215px)] overflow-y-auto p-2 space-y-2 custom-scroll">
        {!selectedUser ? (
          <p className="text-gray-400 text-center mt-20">
            Please select a user to start chatting 📩
          </p>
        ) : (
          <>
             {uniqueMessages.map((e, i) => {
              const isSentByMe = e.sender === loggedInUser?._id;
              const uniqueKey = `${e._id}-${i}`;

              return (
                <div
                  className={`flex flex-col gap-1 mt-2 ${
                    isSentByMe ? "items-end" : "items-start"
                  }`}
                  key={uniqueKey}
                >
                  <div className={`flex items-center gap-2 group max-w-sm ${isSentByMe ? "flex-row-reverse" : "flex-row"}`}>
                    <div
                      className={`rounded-lg p-3 transition-opacity duration-300 relative ${
                        isSentByMe
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-white"
                      } ${e.isSending ? "opacity-60" : ""}`}
                    >
                      {editingMessageId === e._id ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <textarea
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            className="bg-gray-800 text-white p-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm resize-none w-full"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="p-1 hover:bg-gray-600 rounded text-red-400 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                onEditMessage(e._id, editingText);
                                setEditingMessageId(null);
                              }}
                              className="p-1 hover:bg-gray-600 rounded text-green-400 transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {e.messageType === "image" && e.image && (
                            <div className="relative group">
                              <img
                                src={e.image.url}
                                alt="shared image"
                                className="max-w-full h-auto rounded-lg"
                              />
                            </div>
                          )}

                          {e.messageType === "audio" && e.audio && (
                            <div className="relative group min-w-[240px] py-1">
                              <audio
                                src={e.audio.url}
                                controls
                                className="max-w-full h-9 rounded filter invert opacity-90"
                              />
                            </div>
                          )}

                          {e.text && <p className="mt-1">{e.text}</p>}
                        </>
                      )}
                    </div>

                    {/* Action buttons on hover */}
                    {isSentByMe && !e.isSending && editingMessageId !== e._id && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity duration-200">
                        {e.messageType === "text" && (
                          <button
                            onClick={() => {
                              setEditingMessageId(e._id);
                              setEditingText(e.text || "");
                            }}
                            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-blue-400 transition-colors border border-gray-700 bg-gray-900/60"
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
                          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-red-400 transition-colors border border-gray-700 bg-gray-900/60"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    className={`flex items-center gap-1 text-xs text-gray-400 ${
                      isSentByMe ? "pr-2 flex-row-reverse" : "pl-2"
                    }`}
                  >
                    <span>{moment(e.createdAt).format("hh:mm A . MMM D")}</span>

                    {isSentByMe && (
                      <div className="flex items-center ml-1">
                        {e.isSending ? (
                          <Clock className="w-3 h-3 text-gray-400 animate-pulse" />
                        ) : e.seen ? (
                          <div className="flex items-center gap-1 text-blue-400">
                            <CheckCheck className="w-3 h-3" />
                            {e.seenAt && (
                              <span>{moment(e.seenAt).format("hh:mm A")}</span>
                            )}
                          </div>
                        ) : (
                          <Check className="w-3 h-3 text-gray-500" />
                        )}
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
    </div>
  );
};

export default ChatMessages;
