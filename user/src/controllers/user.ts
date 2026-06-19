import { generateToken } from "../config/generateToken.js";
import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { User } from "../model/User.js";

export const loginUser = TryCatch(async (req, res) => {
  const { email } = req.body;
  const rateLimitKey = `otp:ratelimit:${email}`;
  const rateLimit = await redisClient.get(rateLimitKey);
  if (rateLimit) {
    res.status(429).json({
      message: "Too may requests. Please wait before requesting new opt",
    });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp); // Log the generated OTP for debugging

  const otpKey = `otp:${email}`;
  await redisClient.set(otpKey, otp, {
    EX: 300,
  });

  await redisClient.set(rateLimitKey, "true", {
    EX: 60,
  });

  const message = {
    to: email,
    subject: "Your otp code",
    body: `Your OTP is ${otp}. It is valid for 5 minutes`,
  };

  await publishToQueue("send-otp", message);

  res.status(200).json({
    message: "OTP sent to your mail",
  });
});

export const verifyUser = TryCatch(async (req, res) => {
  const { email, otp: enteredOtp } = req.body;

  if (!email || !enteredOtp) {
    res.status(400).json({
      message: "Email and OTP Required",
    });
    return;
  }

  const otpKey = `otp:${email}`;

  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp || storedOtp !== enteredOtp) {
    res.status(400).json({
      message: "Invalid or expired OTP",
    });
    return;
  }

  await redisClient.del(otpKey);

  let user = await User.findOne({ email });

  if (!user) {
    const name = email.slice(0, 8);
    user = await User.create({ name, email });
  }

  const token = generateToken(user);

  res.json({
    message: "User Verified",
    user,
    token,
  });
});

export const myProfile = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  res.json(user);
});

export const updateName = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    res.status(404).json({
      message: "Please login",
    });
    return;
  }

  if (req.body) {
    if (req.body.name && req.body.name.trim() !== "") user.name = req.body.name;
    if (req.body.about !== undefined) user.about = req.body.about;
    if (req.body.showLastSeen !== undefined) {
      user.showLastSeen = req.body.showLastSeen === "true" || req.body.showLastSeen === true;
    }
    if (req.body.username !== undefined) {
      const trimmedUsername = req.body.username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,15}$/.test(trimmedUsername)) {
        res.status(400).json({
          message: "Username must be 3-15 characters and contain only lowercase letters, numbers, and underscores.",
        });
        return;
      }
      const existingUser = await User.findOne({ username: trimmedUsername });
      if (existingUser && String(existingUser._id) !== String(user._id)) {
        res.status(400).json({
          message: "Username is already taken by another user",
        });
        return;
      }
      user.username = trimmedUsername;
    }
  }

  if (!user.name || user.name.trim() === "") {
    user.name = "User";
  }

  if (req.file) {
    user.profilePic = {
      url: req.file.path,
      publicId: req.file.filename,
    };
  }

  await user.save();

  const token = generateToken(user);

  res.json({
    message: "User Updated",
    user,
    token,
  });
});

export const getAllUsers = TryCatch(async (req: AuthenticatedRequest, res) => {
  const users = await User.find();
  res.json(users);
});

export const getAUser = TryCatch(async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});

export const updateLastSeenInternal = TryCatch(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({
      message: "User not found",
    });
    return;
  }
  user.lastSeen = new Date();
  await user.save();
  res.json({
    message: "Last seen updated",
    user,
  });
});

export const requestDeleteOtp = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const rateLimitKey = `delete-otp:ratelimit:${user.email}`;
  const rateLimit = await redisClient.get(rateLimitKey);
  if (rateLimit) {
    res.status(429).json({
      message: "Too many requests. Please wait 1 minute before requesting a new OTP.",
    });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated Delete OTP:", otp);

  const otpKey = `delete-otp:${user.email}`;
  await redisClient.set(otpKey, otp, { EX: 300 }); // 5 minutes
  await redisClient.set(rateLimitKey, "true", { EX: 60 }); // 1 minute rate limit

  const message = {
    to: user.email,
    subject: "Confirm Account Deletion",
    body: `Your OTP for deleting your Chatify account is ${otp}. It is valid for 5 minutes. If you did not request this, please ignore this email.`,
  };

  await publishToQueue("send-otp", message);

  res.status(200).json({
    message: "Deletion OTP sent to your registered email.",
  });
});

export const confirmDeleteAccount = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { otp } = req.body;
  if (!otp) {
    res.status(400).json({ message: "OTP is required" });
    return;
  }

  const otpKey = `delete-otp:${user.email}`;
  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp || storedOtp !== otp) {
    res.status(400).json({ message: "Invalid or expired OTP" });
    return;
  }

  await redisClient.del(otpKey);

  // Delete user from Database
  await User.findByIdAndDelete(user._id);

  res.status(200).json({
    message: "Your account has been deleted successfully.",
  });
});
