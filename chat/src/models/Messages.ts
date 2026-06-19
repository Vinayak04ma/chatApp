import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  chatId: Types.ObjectId;
  sender: string;
  text?: string;
  image?: {
    url: string;
    publicId: string;
  };
  audio?: {
    url: string;
    publicId: string;
  };
  messageType: "text" | "image" | "audio" | "call";
  seen: boolean;
  seenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: String,
      requred: true,
    },
    text: String,
    image: {
      url: String,
      publicId: String,
    },
    audio: {
      url: String,
      publicId: String,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "audio", "call"],
      default: "text",
    },
    seen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Messages = mongoose.model<IMessage>("Messages", schema);
