import mongoose, { Document, Schema } from "mongoose";

export interface IChat extends Document {
  users: string[];
  latestMessage?: {
    text: string;
    sender: string;
  };
  isGroup: boolean;
  groupName?: string;
  groupAdmin?: string;
  groupDescription?: string;
  groupPic?: {
    url: string;
    publicId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema: Schema<IChat> = new Schema(
  {
    users: [{ type: String, required: true }],
    latestMessage: {
      text: String,
      sender: String,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
    },
    groupAdmin: {
      type: String,
    },
    groupDescription: {
      type: String,
    },
    groupPic: {
      url: String,
      publicId: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Chat = mongoose.model<IChat>("Chat", schema);
