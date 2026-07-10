import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const statementSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    correctBoolean: {
      type: Boolean,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassRoom",
      required: true,
    },

    type: {
      type: String,
      enum: ["SINGLE_CHOICE", "TRUE_FALSE_GROUP", "SHORT_ANSWER"],
      required: true,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    orderIndex: {
      type: Number,
      default: 0,
    },

    point: {
      type: Number,
      required: true,
    },

    // Dùng cho SINGLE_CHOICE
    options: {
      type: [optionSchema],
      default: [],
    },

    correctOption: {
      type: String,
      enum: ["A", "B", "C", "D", ""],
      default: "",
    },

    // Dùng cho TRUE_FALSE_GROUP
    statements: {
      type: [statementSchema],
      default: [],
    },

    // Dùng cho SHORT_ANSWER
    acceptedAnswers: {
      type: [String],
      default: [],
    },

    shortAnswerConfig: {
      caseSensitive: {
        type: Boolean,
        default: false,
      },

      trimSpaces: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

quizQuestionSchema.index({ quizId: 1 });
quizQuestionSchema.index({ classId: 1 });
quizQuestionSchema.index({ orderIndex: 1 });

export default mongoose.model("QuizQuestion", quizQuestionSchema);