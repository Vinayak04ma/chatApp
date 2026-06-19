import { Loader2, Paperclip, Send, X, Mic, Square, Trash2 } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";

interface MessageInputProps {
  selectedUser: string | null;
  message: string;
  setMessage: (message: string) => void;
  handleMessageSend: (
    e: any,
    imageFile?: File | null,
    audioFile?: File | null
  ) => void;
}

const MessageInput = ({
  selectedUser,
  message,
  setMessage,
  handleMessageSend,
}: MessageInputProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([audioBlob], "voice.webm", { type: "audio/webm" });
        setAudioFile(file);

        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = () => {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.stop();
    }
    setIsRecording(false);
  };

  const audioUrl = useMemo(() => {
    if (!audioFile) return "";
    return URL.createObjectURL(audioFile);
  }, [audioFile]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!message.trim() && !imageFile && !audioFile) return;

    setIsUploading(true);
    await handleMessageSend(e, imageFile, audioFile);
    setImageFile(null);
    setAudioFile(null);
    setIsUploading(false);
  };

  if (!selectedUser) return null;
  return (
    <form
      onSubmit={handleSubmit}
      className="w-full bg-[#202c33] border-t border-[#2a3942] px-6 py-3 flex flex-col gap-2 flex-shrink-0 z-20 shadow-inner"
    >
      {imageFile && (
        <div className="relative w-fit bg-[#111b21] p-1.5 rounded-xl border border-gray-700">
          <img
            src={URL.createObjectURL(imageFile)}
            alt="preview"
            className="w-20 h-20 object-cover rounded-lg"
          />
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 bg-[#202c33] hover:bg-[#2a3942] rounded-full p-1 border border-gray-650"
            onClick={() => setImageFile(null)}
          >
            <X className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      )}

      {audioFile && (
        <div className="relative flex items-center gap-3 bg-[#111b21] p-2.5 rounded-xl border border-gray-700 w-fit max-w-xs">
          <audio src={audioUrl} controls className="h-9 max-w-full" />
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 bg-[#202c33] hover:bg-[#2a3942] rounded-full p-1 border border-gray-650 text-red-500 hover:text-red-400"
            onClick={() => setAudioFile(null)}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3.5">
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-[#111b21] border border-red-500/20 rounded-lg px-4 py-2 text-white">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-300">
                Recording {formatDuration(recordingDuration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="text-gray-400 hover:text-red-400 transition-colors p-1"
                title="Cancel recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="bg-red-655 text-white rounded-full p-1.5 transition-colors animate-pulse bg-red-600 hover:bg-red-750"
                title="Stop and preview"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="cursor-pointer hover:bg-[#2a3942]/65 text-gray-400 hover:text-gray-200 rounded-full p-2 transition-colors flex items-center justify-center">
              <Paperclip size={20} className="transform rotate-45" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.type.startsWith("image/")) {
                    setImageFile(file);
                  }
                }}
              />
            </label>

            <input
              type="text"
              className="flex-1 bg-[#2a3942] text-sm text-gray-200 placeholder-gray-400 rounded-lg px-4 py-2.5 focus:outline-none disabled:opacity-50 border border-transparent focus:border-green-500/10"
              placeholder={
                imageFile
                  ? "Add a caption..."
                  : audioFile
                  ? "Voice message preview..."
                  : "Type a message"
              }
              value={message}
              disabled={isUploading || !!audioFile}
              onChange={(e) => setMessage(e.target.value)}
            />

            {!message.trim() && !imageFile && !audioFile ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={isUploading}
                className="hover:bg-[#2a3942]/65 text-gray-400 hover:text-gray-200 p-2.5 rounded-full transition-colors flex items-center justify-center"
                title="Record voice message"
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!imageFile && !message && !audioFile) || isUploading}
                className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-full transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
};

export default MessageInput;
