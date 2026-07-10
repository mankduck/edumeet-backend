import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      required: true,
    },

    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    questionCount: {
      type: Number,
      default: 0,
    },

    totalPoint: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["INACTIVE", "ACTIVE", "PAUSED", "ARCHIVED"],
      default: "INACTIVE",
    },

    creationMode: {
      type: String,
      enum: ["MANUAL", "IMPORT"],
      default: "MANUAL",
    },

    submissionCount: {
      type: Number,
      default: 0,
    },

    isLocked: {
      type: Boolean,
      default: false,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    pausedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

quizSchema.index({ classId: 1 });
quizSchema.index({ lessonId: 1 });
quizSchema.index({ status: 1 });

export default mongoose.model("Quiz", quizSchema);