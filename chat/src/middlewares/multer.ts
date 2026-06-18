import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file: any) => {
    const isAudio = file.mimetype.startsWith("audio/");
    return {
      folder: isAudio ? "chat-audios" : "chat-images",
      resource_type: isAudio ? "video" : "image",
      allowed_formats: isAudio
        ? ["webm", "wav", "mp3", "ogg", "m4a", "aac", "mp4"]
        : ["jpg", "jpeg", "png", "gif", "webp"],
      transformation: isAudio
        ? undefined
        : [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto" },
          ],
    } as any;
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and audio allowed") as any);
    }
  },
});
