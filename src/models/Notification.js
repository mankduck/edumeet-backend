import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    meetSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetSession",
      default: null,
    },

    type: {
      type: String,
      enum: ["EMAIL", "SYSTEM"],
      default: "EMAIL",
    },

    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      default: "PENDING",
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    errorMessage: {
      type: String,
      default: "",
    },

    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1 });
notificationSchema.index({ meetSessionId: 1 });

export default mongoose.model("Notification", notificationSchema);