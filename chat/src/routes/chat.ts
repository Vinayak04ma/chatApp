import express from "express";
import isAuth from "../middlewares/isAuth.js";
import {
  createNewChat,
  getAllChats,
  getMessagesByChat,
  sendMessage,
} from "../controllers/chat.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

router.post("/chat/new", isAuth, createNewChat);
router.get("/chat/all", isAuth, getAllChats);
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

export default router;
