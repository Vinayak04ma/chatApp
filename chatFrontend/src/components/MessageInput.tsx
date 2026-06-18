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
      className="flex flex-col gap-2 border-t border-gray-700 pt-2"
    >
      {imageFile && (
        <div className="relative w-fit">
          <img
            src={URL.createObjectURL(imageFile)}
            alt="preview"
            className="w-24 h-24 object-cover rounded-lg border border-gray-600"
          />
          <button
            type="button"
            className="absolute -top-2 -right-2 bg-black rounded-full p-1"
            onClick={() => setImageFile(null)}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {audioFile && (
        <div className="relative flex items-center gap-3 bg-gray-800 p-2.5 rounded-lg border border-gray-600 w-fit max-w-xs">
          <audio src={audioUrl} controls className="h-9 max-w-full" />
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 bg-black rounded-full p-0.5 text-red-500 hover:text-red-400 border border-gray-600"
            onClick={() => setAudioFile(null)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-gray-850 border border-red-500/30 rounded-lg px-4 py-2 text-white">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-300">
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
                className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-colors animate-pulse"
                title="Stop and preview"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2 transition-colors">
              <Paperclip size={18} className="text-gray-300" />
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
              className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 disabled:opacity-50"
              placeholder={
                imageFile
                  ? "Add a caption..."
                  : audioFile
                  ? "Voice message preview..."
                  : "Type a message..."
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
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-2.5 rounded-lg transition-colors"
                title="Record voice message"
              >
                <Mic className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!imageFile && !message && !audioFile) || isUploading}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
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
