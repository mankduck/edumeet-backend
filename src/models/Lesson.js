import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
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

    orderIndex: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "HIDDEN"],
      default: "PUBLISHED",
    },
  },
  {
    timestamps: true,
  }
);

lessonSchema.index({ classId: 1 });

export default mongoose.model("Lesson", lessonSchema);