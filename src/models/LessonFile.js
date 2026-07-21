import mongoose from "mongoose";

const lessonFileSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fileType: {
      type: String,
      enum: ["WORD", "EXCEL", "POWERPOINT", "PDF", "IMAGE", "VIDEO", "ZIP", "AUDIO"],
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    downloadUrl: {
      type: String,
      default: "",
    },

    googleDriveFileId: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      default: "",
    },

    size: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

lessonFileSchema.index({ lessonId: 1 });

export default mongoose.model("LessonFile", lessonFileSchema);
