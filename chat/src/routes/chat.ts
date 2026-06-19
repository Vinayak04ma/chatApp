import express from "express";
import isAuth from "../middlewares/isAuth.js";
import {
  createNewChat,
  getAllChats,
  getMessagesByChat,
  sendMessage,
  deleteMessage,
  editMessage,
  deleteChat,
  createGroupChat,
  getChatDetails,
  logCall,
  getCallHistory,
} from "../controllers/chat.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

router.post("/chat/new", isAuth, createNewChat);
router.get("/chat/all", isAuth, getAllChats);
router.delete("/chat/:chatId", isAuth, deleteChat);
router.get("/chat/details/:chatId", isAuth, getChatDetails);
router.post("/group/new", isAuth, upload.single("file"), createGroupChat);
router.post(
  "/message",
  isAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  sendMessage
);
router.get("/message/:chatId", isAuth, getMessagesByChat);
router.delete("/message/:messageId", isAuth, deleteMessage);
router.put("/message/:messageId", isAuth, editMessage);
router.post("/call/log", isAuth, logCall);
router.get("/call/history", isAuth, getCallHistory);

export default router;
