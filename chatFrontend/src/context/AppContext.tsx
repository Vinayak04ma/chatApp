"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
  import Cookies from "js-cookie";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

export const user_service = process.env.NEXT_PUBLIC_USER_SERVICE_URL || "http://16.171.41.165:5000";
export const chat_service = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || "http://16.171.41.165:5002";
export const mail_service = process.env.NEXT_PUBLIC_MAIL_SERVICE_URL || "";


export interface User {
  _id: string;
  name: string;
  email: string;
}

export interface Chat {
  _id: string;
  users: string[];
  latestMessage: {
    text: string;
    sender: string;
  };
  createdAt: string;
  updatedAt: string;
  unseenCount?: number;
}

export interface Chats {
  _id: string;
  user: User;
  chat: Chat;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  isAuth: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuth: React.Dispatch<React.SetStateAction<boolean>>;
  logoutUser: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchChats: () => Promise<void>;
  chats: Chats[] | null;
  users: User[] | null;
  setChats: React.Dispatch<React.SetStateAction<Chats[] | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    const token = Cookies.get("token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await axios.get(`${user_service}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(data);
      setIsAuth(true);
      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  }

  async function logoutUser() {
    Cookies.remove("token");
    setUser(null);
    setIsAuth(false);
    toast.success("User Logged Out");
  }

  const [chats, setChats] = useState<Chats[] | null>(null);
  async function fetchChats() {
    const token = Cookies.get("token");
    if (!token) return;
    try {
      const { data } = await axios.get(`${chat_service}/api/v1/chat/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setChats(data.chats);
    } catch (error) {
      console.log(error);
    }
  }

  const [users, setUsers] = useState<User[] | null>(null);

  async function fetchUsers() {
    const token = Cookies.get("token");
    if (!token) return;

    try {
      const { data } = await axios.get(`${user_service}/api/v1/user/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(data);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    // Wake up microservices in background on page load
    fetch(`${user_service}/ping`).catch(() => {});
    fetch(`${chat_service}/ping`).catch(() => {});
    if (mail_service) {
      fetch(`${mail_service}/ping`).catch(() => {});
    }
    fetchUser();
    fetchChats();
    fetchUsers();
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isAuth,
        setIsAuth,
        loading,
        logoutUser,
        fetchChats,
        fetchUsers,
        chats,
        users,
        setChats,
      }}
    >
      {children}
      <Toaster />
    </AppContext.Provider>
  );
};

export const useAppData = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useappdata must be used within AppProvider");
  }
  return context;
};
