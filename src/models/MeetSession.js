import mongoose from "mongoose";

const meetSessionSchema = new mongoose.Schema(
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

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

    meetUrl: {
      type: String,
      required: true,
    },

    googleEventId: {
      type: String,
      default: "",
    },

    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["SCHEDULED", "FINISHED", "CANCELLED"],
      default: "SCHEDULED",
    },

    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

meetSessionSchema.index({ classId: 1 });
meetSessionSchema.index({ teacherId: 1 });
meetSessionSchema.index({ startAt: 1 });

export default mongoose.model("MeetSession", meetSessionSchema);