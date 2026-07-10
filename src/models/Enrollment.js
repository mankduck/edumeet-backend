import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "REMOVED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

// Một học sinh không bị add trùng vào cùng một lớp
enrollmentSchema.index(
  {
    classId: 1,
    studentId: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model("Enrollment", enrollmentSchema);