"use client";
import React, { useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import toast from "react-hot-toast";
import { useAppData, user_service } from "@/context/AppContext";
import { UserCircle, Camera, Sparkles, User, Info, AtSign } from "lucide-react";

interface OnboardingSetupProps {
  loggedInUser: any;
}

const OnboardingSetup = ({ loggedInUser }: OnboardingSetupProps) => {
  const { setUser } = useAppData();
  const [name, setName] = useState(loggedInUser?.name || "");
  const [about, setAbout] = useState("Hey there! I am using Chatify.");
  const [username, setUsername] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(loggedInUser?.profilePic?.url || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setProfilePicUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,15}$/.test(cleanUsername)) {
      toast.error("Username must be 3-15 characters and contain only lowercase letters, numbers, and underscores.");
      return;
    }

    const token = Cookies.get("token");
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("about", about.trim());
    formData.append("username", cleanUsername);
    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    setIsUploading(true);
    const toastId = toast.loading("Setting up your profile...");
    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/update/user`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      Cookies.set("token", data.token, { expires: 15, path: "/" });
      toast.success("Profile setup completed!", { id: toastId });
      setUser(data.user);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to set up profile", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0b141a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-green-550/5 bg-green-550/5 opacity-5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#111b21] border border-gray-800 rounded-2xl shadow-2xl p-8 z-10 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-green-400" />
          <h2 className="text-xl font-bold text-white tracking-wide">Welcome to Chatify</h2>
        </div>
        <p className="text-xs text-gray-400 text-center mb-8">
          Please complete your profile to start messaging and finding friends.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group w-24 h-24 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex items-center justify-center cursor-pointer shadow-lg">
              {profilePicUrl ? (
                <img src={profilePicUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-16 h-16 text-gray-400" />
              )}
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] gap-1 cursor-pointer">
                <Camera className="w-4 h-4" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold">Choose a profile picture</span>
          </div>

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" /> Unique Username
            </label>
            <input
              type="text"
              required
              placeholder="e.g. johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
              className="w-full bg-[#202c33] border border-transparent focus:border-green-500/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              3-15 chars, lowercase, numbers, or underscores. This is unique to you.
            </p>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Full Name
            </label>
            <input
              type="text"
              required
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#202c33] border border-transparent focus:border-green-500/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
          </div>

          {/* About Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> About
            </label>
            <input
              type="text"
              placeholder="Hey there! I am using Chatify."
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="w-full bg-[#202c33] border border-transparent focus:border-green-500/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-550 focus:outline-none transition-colors"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isUploading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg shadow-lg hover:shadow-green-550/20 transition-all flex items-center justify-center gap-2"
          >
            {isUploading ? "Setting up..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingSetup;
