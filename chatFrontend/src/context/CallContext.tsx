"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { SocketData } from "./SocketContext";
import { useAppData } from "./AppContext";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";

interface CallContextType {
  callUser: (targetId: string, type: "voice" | "video") => void;
  incomingCall: boolean;
  activeCall: boolean;
  callType: "voice" | "video" | null;
  callUserDetail: any;
  answerCall: () => void;
  declineCall: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket } = SocketData();
  const { user: loggedInUser, users } = useAppData();

  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
  const [incomingCall, setIncomingCall] = useState(false);
  const [activeCall, setActiveCall] = useState(false);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [calleeId, setCalleeId] = useState<string | null>(null);
  const [incomingSignal, setIncomingSignal] = useState<any>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const callUserDetail = users?.find(
    (u) => u._id === (incomingCall ? callerId : calleeId)
  ) || { name: "Unknown User" };

  // Listen to Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("hey", (data) => {
      setCallerId(data.from);
      setIncomingSignal(data.signal);
      setCallType(data.type);
      setIncomingCall(true);
    });

    socket.on("endCall", () => {
      cleanupCall();
    });

    return () => {
      socket.off("hey");
      socket.off("endCall");
    };
  }, [socket]);

  // Handle incoming ice candidates
  useEffect(() => {
    if (!socket) return;

    const handleIceCandidate = (candidate: RTCIceCandidateInit) => {
      if (peerRef.current && peerRef.current.remoteDescription) {
        peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    };

    socket.on("iceCandidate", handleIceCandidate);
    return () => {
      socket.off("iceCandidate", handleIceCandidate);
    };
  }, [socket]);

  const cleanupCall = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setIncomingCall(false);
    setActiveCall(false);
    setCallerId(null);
    setCalleeId(null);
    setIncomingSignal(null);
    setCallType(null);
    setIsMuted(false);
    setIsVideoOff(false);
    iceCandidatesQueue.current = [];
  };

  const createPeerConnection = (targetId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("iceCandidate", {
          candidate: event.candidate,
          to: targetId,
        });
      }
    };

    peerRef.current = pc;
    return pc;
  };

  const callUser = async (targetId: string, type: "voice" | "video") => {
    if (!socket || !loggedInUser) return;
    setCalleeId(targetId);
    setCallType(type);
    setActiveCall(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      setLocalStream(stream);

      const pc = createPeerConnection(targetId, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", {
        userToCall: targetId,
        signalData: offer,
        from: loggedInUser._id,
        name: loggedInUser.name,
        type: type,
      });

      socket.once("callAccepted", async (signal: RTCSessionDescriptionInit) => {
        if (peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift();
            if (candidate) {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            }
          }
        }
      });
    } catch (err) {
      console.error("Error accessing devices:", err);
      cleanupCall();
    }
  };

  const answerCall = async () => {
    if (!socket || !callerId || !incomingSignal) return;
    setIncomingCall(false);
    setActiveCall(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      setLocalStream(stream);

      const pc = createPeerConnection(callerId, stream);

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));

      while (iceCandidatesQueue.current.length > 0) {
        const candidate = iceCandidatesQueue.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answerCall", {
        signal: answer,
        to: callerId,
      });
    } catch (err) {
      console.error("Error answering call:", err);
      cleanupCall();
    }
  };

  const declineCall = () => {
    if (socket && callerId) {
      socket.emit("endCall", { to: callerId });
    }
    cleanupCall();
  };

  const endCall = () => {
    const targetId = incomingCall ? callerId : calleeId;
    if (socket && targetId) {
      socket.emit("endCall", { to: targetId });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === "video") {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Assign stream to video elements when active
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <CallContext.Provider
      value={{
        callUser,
        incomingCall,
        activeCall,
        callType,
        callUserDetail,
        answerCall,
        declineCall,
        endCall,
      }}
    >
      {children}

      {(incomingCall || activeCall) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md text-white p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md flex flex-col items-center shadow-2xl relative overflow-hidden">
            
            <div className="flex flex-col items-center mt-6 mb-8 text-center">
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl font-bold uppercase shadow-lg border-2 border-white/20 mb-4 animate-pulse">
                {callUserDetail.name.charAt(0)}
              </div>
              <h3 className="text-2xl font-semibold">{callUserDetail.name}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {incomingCall
                  ? `Incoming ${callType} call...`
                  : !remoteStream
                  ? "Ringing..."
                  : `${callType === "video" ? "Video" : "Voice"} call connected`}
              </p>
            </div>

            {callType === "video" && (localStream || remoteStream) && (
              <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative mb-6 border border-gray-800">
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-955 text-gray-400 text-sm">
                    Connecting video...
                  </div>
                )}

                {localStream && !isVideoOff && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-2 right-2 w-28 aspect-video bg-gray-800 rounded-md object-cover border border-white/20 shadow-md"
                  />
                )}
              </div>
            )}

            <div className="flex gap-6 mt-4">
              {incomingCall ? (
                <>
                  <button
                    onClick={declineCall}
                    className="bg-red-600 hover:bg-red-700 p-4 rounded-full transition-all text-white shadow-lg hover:scale-105"
                    title="Decline"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                  <button
                    onClick={answerCall}
                    className="bg-green-600 hover:bg-green-700 p-4 rounded-full transition-all text-white shadow-lg hover:scale-105 animate-bounce"
                    title="Accept"
                  >
                    {callType === "video" ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={`p-4 rounded-full transition-all shadow-lg hover:scale-105 ${
                      isMuted ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    <Mic className="w-6 h-6" />
                  </button>

                  {callType === "video" && (
                    <button
                      onClick={toggleVideo}
                      className={`p-4 rounded-full transition-all shadow-lg hover:scale-105 ${
                        isVideoOff ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                      title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                    >
                      {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </button>
                  )}

                  <button
                    onClick={endCall}
                    className="bg-red-600 hover:bg-red-700 p-4 rounded-full transition-all text-white shadow-lg hover:scale-105"
                    title="End Call"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </CallContext.Provider>
  );
};

export const CallData = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallData must be used within a CallProvider");
  }
  return context;
};
