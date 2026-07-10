import mongoose from "mongoose";

const violationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["EXIT_FULLSCREEN", "TAB_HIDDEN", "WINDOW_BLUR", "RELOAD_ATTEMPT"],
      required: true,
    },

    occurredAt: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    questionSnapshot: {
      type: Object,
      required: true,
    },

    selectedOption: {
      type: String,
      enum: ["A", "B", "C", "D", ""],
      default: "",
    },

    selectedTrueFalseAnswers: {
      type: [
        {
          key: {
            type: String,
            enum: ["A", "B", "C", "D"],
          },
          value: {
            type: Boolean,
          },
        },
      ],
      default: [],
    },

    shortAnswerText: {
      type: String,
      default: "",
    },

    correctAnswerSnapshot: {
      type: Object,
      required: true,
    },

    isCorrect: {
      type: Boolean,
      default: false,
    },

    pointEarned: {
      type: Number,
      default: 0,
    },

    maxPoint: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const quizSubmissionSchema = new mongoose.Schema(
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

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED", "AUTO_SUBMITTED"],
      default: "IN_PROGRESS",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    score: {
      type: Number,
      default: 0,
    },

    totalPoint: {
      type: Number,
      default: 0,
    },

    questionCount: {
      type: Number,
      default: 0,
    },

    violationCount: {
      type: Number,
      default: 0,
    },

    violations: {
      type: [violationSchema],
      default: [],
    },

    answers: {
      type: [answerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

quizSubmissionSchema.index(
  {
    quizId: 1,
    studentId: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model("QuizSubmission", quizSubmissionSchema);