import mongoose from "mongoose";

const classRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    grade: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "UPCOMING", "ARCHIVED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// Một giáo viên không được tạo trùng tên lớp
classRoomSchema.index(
  {
    teacherId: 1,
    name: 1,
  },
  {
    unique: true,
  }
);

classRoomSchema.index({ teacherId: 1 });
classRoomSchema.index({ subjectId: 1 });

export default mongoose.model("ClassRoom", classRoomSchema, "classes");