import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  about: string;
  username?: string;
  profilePic?: {
    url: string;
    publicId: string;
  };
  lastSeen?: Date;
  showLastSeen?: boolean;
}

const schema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    about: {
      type: String,
      default: "Hey there! I am using Chatify.",
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    profilePic: {
      url: String,
      publicId: String,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    showLastSeen: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", schema);
