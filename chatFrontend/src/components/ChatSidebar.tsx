import { User, useAppData, user_service, chat_service } from "@/context/AppContext";
import {
  CornerDownRight,
  CornerUpLeft,
  LogOut,
  MessageCircle,
  Search,
  UserCircle,
  X,
  MessageSquare,
  Users,
  Settings,
  ArrowLeft,
  Camera,
  Check,
  Pencil,
  Plus,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import toast from "react-hot-toast";

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
  const [activeTab, setActiveTab] = useState<'chats' | 'new-chat' | 'profile'>('chats');
  
  const { setUser, fetchChats } = useAppData();
  const [isEditName, setIsEditName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [isEditAbout, setIsEditAbout] = useState(false);
  const [aboutVal, setAboutVal] = useState("");
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Group creation states
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupPicFile, setGroupPicFile] = useState<File | null>(null);
  const [groupPicPreview, setGroupPicPreview] = useState("");

  const handleGroupPicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGroupPicFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupPicPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Please select at least one participant");
      return;
    }

    const token = Cookies.get("token");
    const formData = new FormData();
    formData.append("groupName", groupName.trim());
    formData.append("groupDescription", groupDescription.trim());
    formData.append("participants", JSON.stringify(selectedMembers));
    if (groupPicFile) {
      formData.append("file", groupPicFile);
    }

    const toastId = toast.loading("Creating group...");
    try {
      const { data } = await axios.post(
        `${chat_service}/api/v1/group/new`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      toast.success("Group created successfully!", { id: toastId });

      // Reset group states
      setGroupName("");
      setGroupDescription("");
      setSelectedMembers([]);
      setGroupPicFile(null);
      setGroupPicPreview("");
      setIsCreatingGroup(false);
      setShowAllUsers(false);

      // Refresh chats list
      await fetchChats();

      // Open the new group chat
      if (data.chatId) {
        setSelectedUser(data.chatId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create group", { id: toastId });
    }
  };

  // Account Delete states
  const [deleteState, setDeleteState] = useState<'none' | 'requesting' | 'verifying'>('none');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDeleteOtp = async () => {
    const token = Cookies.get("token");
    setIsDeleting(true);
    const toastId = toast.loading("Sending deletion OTP...");
    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/account/delete/request`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success(data.message, { id: toastId });
      setDeleteState('verifying');
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send OTP", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deleteOtp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }
    const token = Cookies.get("token");
    setIsDeleting(true);
    const toastId = toast.loading("Deleting account permanently...");
    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/account/delete/confirm`,
        { otp: deleteOtp.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success(data.message, { id: toastId });
      handleLogout();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete account", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // Sync tab with parent showAllUsers
  useEffect(() => {
    if (showAllUsers) {
      setActiveTab('new-chat');
    } else if (activeTab === 'new-chat') {
      setActiveTab('chats');
    }
  }, [showAllUsers]);

  // Sync user details when loggedInUser loads
  useEffect(() => {
    if (loggedInUser) {
      setNameVal(loggedInUser.name || "");
      setAboutVal(loggedInUser.about || "Hey there! I am using Chatify.");
      setShowLastSeen(loggedInUser.showLastSeen !== false);
    }
  }, [loggedInUser]);

  const handleTabChange = (tab: 'chats' | 'new-chat' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'new-chat') {
      setShowAllUsers(true);
    } else {
      setShowAllUsers(false);
    }
  };

  const toggleLastSeen = async () => {
    const newValue = !showLastSeen;
    setShowLastSeen(newValue);
    const token = Cookies.get("token");
    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/update/user`,
        { showLastSeen: newValue },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Cookies.set("token", data.token, { expires: 15, path: "/" });
      setUser(data.user);
      toast.success(`Last seen privacy updated to ${newValue ? "ON" : "OFF"}`);
    } catch (error: any) {
      setShowLastSeen(!newValue); // rollback
      toast.error("Failed to update last seen privacy");
    }
  };

  const saveName = async () => {
    if (!nameVal.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const token = Cookies.get("token");
    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/update/user`,
        { name: nameVal },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Cookies.set("token", data.token, { expires: 15, path: "/" });
      setUser(data.user);
      setIsEditName(false);
      toast.success("Name updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update name");
    }
  };

  const saveAbout = async () => {
    const token = Cookies.get("token");
    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/update/user`,
        { about: aboutVal },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Cookies.set("token", data.token, { expires: 15, path: "/" });
      setUser(data.user);
      setIsEditAbout(false);
      toast.success("About updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update about");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = Cookies.get("token");
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    const toastId = toast.loading("Uploading profile photo...");
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
      toast.success("Profile photo updated!", { id: toastId });
      setUser(data.user);
    } catch (error: any) {
      toast.error("Failed to upload image", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <aside
      className={`fixed z-20 sm:static top-0 left-0 h-screen w-full max-w-[380px] sm:w-96 bg-[#111b21] border-r border-[#222e35] transform ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } sm:translate-x-0 transition-transform duration-300 flex`}
    >
      {/* 1. Left Narrow WhatsApp Nav Sidebar */}
      <div className="w-16 h-full bg-[#202c33] border-r border-[#2a3942] flex flex-col justify-between py-4 items-center flex-shrink-0">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Avatar button */}
          <button
            onClick={() => handleTabChange('profile')}
            className={`w-9 h-9 rounded-full bg-gray-700 overflow-hidden border transition-all ${
              activeTab === 'profile'
                ? "border-green-500 ring-2 ring-green-500/20"
                : "border-gray-600 hover:border-gray-400"
            }`}
            title="Profile"
          >
            {loggedInUser?.profilePic?.url ? (
              <img
                src={loggedInUser.profilePic.url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserCircle className="w-full h-full text-gray-300" />
            )}
          </button>

          {/* Nav Tabs */}
          <div className="flex flex-col items-center gap-3 w-full px-2">
            <button
              onClick={() => handleTabChange('chats')}
              className={`p-2.5 rounded-xl transition-all ${
                activeTab === 'chats'
                  ? "bg-[#2a3942] text-green-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2a3942]/50"
              }`}
              title="Chats"
            >
              <MessageSquare className="w-5.5 h-5.5" />
            </button>

            <button
              onClick={() => handleTabChange('new-chat')}
              className={`p-2.5 rounded-xl transition-all ${
                activeTab === 'new-chat'
                  ? "bg-[#2a3942] text-green-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2a3942]/50"
              }`}
              title="New Chat"
            >
              <Users className="w-5.5 h-5.5" />
            </button>

            <button
              onClick={() => handleTabChange('profile')}
              className={`p-2.5 rounded-xl transition-all ${
                activeTab === 'profile'
                  ? "bg-[#2a3942] text-green-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2a3942]/50"
              }`}
              title="Profile Settings"
            >
              <Settings className="w-5.5 h-5.5" />
            </button>
          </div>
        </div>

        {/* Logout action at bottom */}
        <div className="w-full px-2">
          <button
            onClick={handleLogout}
            className="w-full p-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all flex items-center justify-center"
            title="Logout"
          >
            <LogOut className="w-5.5 h-5.5" />
          </button>
        </div>
      </div>

      {/* 2. Right Sub-sidebar Content Panel */}
      <div className="flex-1 flex flex-col h-full bg-[#111b21] overflow-hidden">
        {activeTab === 'profile' ? (
          /* Profile Settings Panel */
          <div className="flex-1 flex flex-col h-full bg-[#111b21]">
            {/* Header */}
            <div className="px-5 py-4 bg-[#202c33] border-b border-[#2a3942] flex items-center gap-4 flex-shrink-0">
              <button
                onClick={() => handleTabChange('chats')}
                className="p-1.5 hover:bg-[#2a3942] rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-white tracking-wide">Profile Settings</h2>
            </div>

            {/* Profile Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scroll pb-10">
              {/* Profile Pic Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group w-32 h-32 rounded-full overflow-hidden border border-[#2a3942] bg-gray-800 flex items-center justify-center shadow-lg">
                  {loggedInUser?.profilePic?.url ? (
                    <img
                      src={loggedInUser.profilePic.url}
                      alt="Profile"
                      className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                    />
                  ) : (
                    <UserCircle className="w-20 h-20 text-gray-400 group-hover:opacity-40 transition-opacity" />
                  )}
                  <label className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer bg-black/55 transition-opacity text-white text-xs gap-1">
                    <Camera className="w-5 h-5" />
                    <span className="font-semibold text-[10px]">Change Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>

              {/* Name Section */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">Your Name</label>
                {isEditName ? (
                  <div className="flex items-center gap-2 bg-[#202c33] rounded-lg p-2 border border-gray-750">
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      className="bg-transparent text-sm text-gray-200 focus:outline-none flex-1"
                      autoFocus
                    />
                    <button onClick={saveName} className="text-green-400 hover:text-green-300 p-1">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setIsEditName(false); setNameVal(loggedInUser?.name || ""); }} className="text-red-400 hover:text-red-300 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-[#202c33]/40 p-3 rounded-lg border border-gray-800/40">
                    <span className="text-sm text-gray-200">{loggedInUser?.name}</span>
                    <button onClick={() => setIsEditName(true)} className="text-gray-400 hover:text-white p-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  This is not your username or pin. This name will be visible to your Chatify contacts.
                </p>
              </div>

              {/* About Section */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">About</label>
                {isEditAbout ? (
                  <div className="flex items-center gap-2 bg-[#202c33] rounded-lg p-2 border border-gray-750">
                    <input
                      type="text"
                      value={aboutVal}
                      onChange={(e) => setAboutVal(e.target.value)}
                      className="bg-transparent text-sm text-gray-200 focus:outline-none flex-1"
                      autoFocus
                    />
                    <button onClick={saveAbout} className="text-green-400 hover:text-green-300 p-1">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setIsEditAbout(false); setAboutVal(loggedInUser?.about || ""); }} className="text-red-400 hover:text-red-300 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-[#202c33]/40 p-3 rounded-lg border border-gray-800/40">
                    <span className="text-sm text-gray-200 truncate pr-4">{loggedInUser?.about || "Hey there! I am using Chatify."}</span>
                    <button onClick={() => setIsEditAbout(true)} className="text-gray-400 hover:text-white p-1 flex-shrink-0">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Username Section */}
              <div className="space-y-2 pt-2 border-t border-[#222e35]/30">
                <label className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">Username</label>
                <div className="flex items-center justify-between bg-[#202c33]/40 p-3 rounded-lg border border-gray-800/40">
                  <span className="text-sm text-gray-200">@{loggedInUser?.username || "not_set"}</span>
                  <span className="text-[10px] text-gray-500 font-semibold italic">Unique Handle</span>
                </div>
              </div>

              {/* Privacy Setting Toggle */}
              <div className="space-y-3 pt-4 border-t border-[#222e35]">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-gray-200">Last Seen Privacy</span>
                    <p className="text-[10px] text-gray-500 pr-6 leading-relaxed">
                      If turned off, other users won't be able to see your last active status.
                    </p>
                  </div>
                  <button
                    onClick={toggleLastSeen}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      showLastSeen ? "bg-green-600" : "bg-gray-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showLastSeen ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Account Deletion Section */}
              <div className="space-y-3 pt-4 border-t border-[#222e35]">
                <label className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Danger Zone</label>
                
                {deleteState === 'none' && (
                  <button
                    onClick={() => setDeleteState('requesting')}
                    className="w-full bg-red-950/20 hover:bg-red-900/30 border border-red-500/25 text-red-400 font-semibold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Delete Account
                  </button>
                )}

                {deleteState === 'requesting' && (
                  <div className="bg-red-950/10 border border-red-500/20 rounded-lg p-3.5 space-y-3">
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Deleting your account will permanently erase your profile, chats, and messages. An OTP will be sent to confirm.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={requestDeleteOtp}
                        disabled={isDeleting}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs py-2 rounded-lg transition-colors text-center"
                      >
                        Send OTP
                      </button>
                      <button
                        onClick={() => setDeleteState('none')}
                        className="flex-1 bg-transparent hover:bg-gray-800 border border-gray-700 text-gray-300 font-semibold text-xs py-2 rounded-lg transition-colors text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {deleteState === 'verifying' && (
                  <div className="bg-red-950/10 border border-red-500/20 rounded-lg p-3.5 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-300">Enter Deletion OTP</label>
                      <input
                        type="text"
                        placeholder="6-digit OTP"
                        value={deleteOtp}
                        onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full bg-[#202c33] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={confirmDeleteAccount}
                        disabled={isDeleting}
                        className="flex-1 bg-red-650 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs py-2 rounded-lg transition-colors text-center"
                      >
                        Verify & Delete
                      </button>
                      <button
                        onClick={() => { setDeleteState('none'); setDeleteOtp(''); }}
                        className="flex-1 bg-transparent hover:bg-gray-800 border border-gray-700 text-gray-300 font-semibold text-xs py-2 rounded-lg transition-colors text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Normal List Tab Content (Chats or All Users/Contacts) */
          <>
            {/* Header */}
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
                      ? "bg-red-955/40 hover:bg-red-900/40 text-red-400 bg-red-950/20"
                      : "bg-green-955/40 hover:bg-green-900/40 text-green-400 bg-green-950/20"
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

            {/* List Content */}
            <div className="flex-1 overflow-hidden px-2 py-3">
              {isCreatingGroup ? (
                /* Group Creation Form */
                <form onSubmit={handleCreateGroup} className="flex flex-col h-full space-y-4">
                  {/* Header / Back button */}
                  <div className="flex items-center gap-2 pb-2 border-b border-[#222e35]/30">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingGroup(false);
                        setGroupName("");
                        setGroupDescription("");
                        setSelectedMembers([]);
                        setGroupPicFile(null);
                        setGroupPicPreview("");
                      }}
                      className="p-1 hover:bg-[#202c33] rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-gray-200">Create New Group</span>
                  </div>

                  {/* Group Profile Photo Pick */}
                  <div className="flex flex-col items-center py-2">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-650">
                        {groupPicPreview ? (
                          <img src={groupPicPreview} alt="Group pic" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-10 h-10 text-gray-400" />
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                        <Camera className="w-5 h-5 text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleGroupPicChange} />
                      </label>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">Group Avatar (Optional)</span>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Group Subject/Name..."
                      required
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#202c33] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                    />
                    <input
                      type="text"
                      placeholder="Group Description (Optional)..."
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-[#202c33] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                    />
                  </div>

                  {/* Member Selection List */}
                  <div className="flex-1 flex flex-col min-h-0 space-y-1">
                    <label className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Select Members</label>
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scroll pr-1">
                      {users
                        ?.filter((u) => u._id !== loggedInUser?._id)
                        .map((u) => {
                          const isSelected = selectedMembers.includes(u._id);
                          return (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => handleMemberToggle(u._id)}
                              className="w-full text-left p-2 rounded-lg hover:bg-[#202c33]/40 transition-colors flex items-center justify-between border-b border-[#222e35]/15"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                                  {u.profilePic?.url ? (
                                    <img src={u.profilePic.url} alt={u.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserCircle className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-200 truncate">{u.name}</div>
                                  {u.username && <div className="text-[9px] text-gray-500">@{u.username}</div>}
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-3.5 h-3.5 accent-green-500 rounded border-gray-650 cursor-pointer"
                              />
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Check className="w-4 h-4" /> Create Group ({selectedMembers.length})
                  </button>
                </form>
              ) : showAllUsers ? (
                /* Users List */
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

                  <div className="flex-1 overflow-y-auto space-y-1 custom-scroll pb-4 px-1">
                    {/* New Group Row */}
                    <button
                      onClick={() => setIsCreatingGroup(true)}
                      className="w-full text-left p-3 rounded-lg hover:bg-[#202c33]/50 transition-colors border-b border-[#222e35]/20 flex items-center gap-3 text-green-400 font-semibold text-sm mb-1.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-950/20 border border-green-900/35 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-green-400" />
                      </div>
                      <span>New Group</span>
                    </button>

                    {users
                      ?.filter(
                        (u) =>
                          u._id !== loggedInUser?._id &&
                          (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (u.username &&
                              u.username.toLowerCase().includes(searchQuery.toLowerCase())))
                      )
                      .map((u) => (
                        <button
                          key={u._id}
                          className="w-full text-left p-3.5 rounded-lg hover:bg-[#202c33]/50 transition-colors border-b border-[#222e35]/35 flex items-center justify-between"
                          onClick={() => createChat(u)}
                        >
                          <div className="flex items-center gap-3 w-full">
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
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm text-gray-200 truncate">{u.name}</span>
                                {u.username && (
                                  <span className="text-[10px] text-green-400 font-semibold bg-green-950/20 px-1.5 py-0.5 rounded flex-shrink-0">
                                    @{u.username}
                                  </span>
                                )}
                              </div>
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
                /* Chats List */
                <div className="overflow-y-auto h-full space-y-0.5 custom-scroll pb-4 px-1">
                  {chats.map((chat) => {
                    const latestMessage = chat.chat.latestMessage;
                    const isSelected = selectedUser === chat.chat._id;
                    const isSentByMe = latestMessage?.sender === loggedInUser?._id;
                    const unseenCount = chat.chat.unseenCount || 0;
                    const chatUser = chat.user || { _id: "", name: "Unknown User", isGroup: false };

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
                              {chatUser.profilePic?.url ? (
                                <img
                                  src={chatUser.profilePic.url}
                                  alt={chatUser.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : chatUser.isGroup ? (
                                <Users className="w-6 h-6 text-gray-300" />
                              ) : (
                                <UserCircle className="w-6 h-6 text-gray-300" />
                              )}
                            </div>
                            {!chatUser.isGroup && onlineUsers.includes(chatUser._id) && (
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
                                {chatUser.name}
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
          </>
        )}
      </div>
    </aside>
  );
};

export default ChatSidebar;
