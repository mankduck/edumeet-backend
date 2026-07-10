import ClassRoom from "../models/ClassRoom.js";
import Lesson from "../models/Lesson.js";
import Quiz from "../models/Quiz.js";
import QuizQuestion from "../models/QuizQuestion.js";
import QuizSubmission from "../models/QuizSubmission.js";
import Enrollment from "../models/Enrollment.js";

const QUESTION_TYPES = {
  SINGLE_CHOICE: "SINGLE_CHOICE",
  TRUE_FALSE_GROUP: "TRUE_FALSE_GROUP",
  SHORT_ANSWER: "SHORT_ANSWER",
};

const QUIZ_STATUSES = ["INACTIVE", "ACTIVE", "PAUSED", "ARCHIVED"];

function getQuestionPoint(type) {
  if (type === QUESTION_TYPES.SINGLE_CHOICE) return 0.5;
  if (type === QUESTION_TYPES.TRUE_FALSE_GROUP) return 1;
  if (type === QUESTION_TYPES.SHORT_ANSWER) return 0.5;

  return 0;
}

async function checkClassPermission(classId, user) {
  const classRoom = await ClassRoom.findById(classId);

  if (!classRoom) {
    return {
      error: {
        status: 404,
        message: "Không tìm thấy lớp học",
      },
    };
  }

  if (
    user.role === "TEACHER" &&
    classRoom.teacherId.toString() !== user._id.toString()
  ) {
    return {
      error: {
        status: 403,
        message: "Bạn không có quyền thao tác với lớp học này",
      },
    };
  }

  return {
    classRoom,
  };
}

async function checkQuizPermission(quizId, user) {
  const quiz = await Quiz.findById(quizId);

  if (!quiz) {
    return {
      error: {
        status: 404,
        message: "Không tìm thấy bài kiểm tra",
      },
    };
  }

  const { classRoom, error } = await checkClassPermission(quiz.classId, user);

  if (error) {
    return {
      error,
    };
  }

  return {
    quiz,
    classRoom,
  };
}

async function ensureQuizEditable(quizId) {
  const submissionCount = await QuizSubmission.countDocuments({
    quizId,
  });

  if (submissionCount > 0) {
    return {
      canEdit: false,
      submissionCount,
      message: "Không thể sửa bài kiểm tra vì đã có học sinh bắt đầu làm bài",
    };
  }

  return {
    canEdit: true,
    submissionCount,
  };
}

function ensureFourKeys(items, fieldName) {
  const keys = (items || []).map((item) => item.key).sort().join("");

  if (keys !== "ABCD") {
    throw new Error(`${fieldName} phải có đủ 4 mục A, B, C, D`);
  }
}

function validateQuestionPayload(question) {
  if (!question.type) {
    throw new Error("Thiếu loại câu hỏi");
  }

  if (!Object.values(QUESTION_TYPES).includes(question.type)) {
    throw new Error("Loại câu hỏi không hợp lệ");
  }

  if (!question.questionText?.trim()) {
    throw new Error("Vui lòng nhập nội dung câu hỏi");
  }

  if (question.type === QUESTION_TYPES.SINGLE_CHOICE) {
    ensureFourKeys(question.options, "Đáp án trắc nghiệm");

    question.options.forEach((option) => {
      if (!option.text?.trim()) {
        throw new Error(`Đáp án ${option.key} không được để trống`);
      }
    });

    if (!["A", "B", "C", "D"].includes(question.correctOption)) {
      throw new Error("Đáp án đúng phải là A, B, C hoặc D");
    }
  }

  if (question.type === QUESTION_TYPES.TRUE_FALSE_GROUP) {
    ensureFourKeys(question.statements, "Mệnh đề đúng/sai");

    question.statements.forEach((statement) => {
      if (!statement.text?.trim()) {
        throw new Error(`Mệnh đề ${statement.key} không được để trống`);
      }

      if (typeof statement.correctBoolean !== "boolean") {
        throw new Error(`Mệnh đề ${statement.key} phải chọn đúng hoặc sai`);
      }
    });
  }

  if (question.type === QUESTION_TYPES.SHORT_ANSWER) {
    const acceptedAnswers = question.acceptedAnswers || [];

    const cleanedAnswers = acceptedAnswers
      .map((answer) => String(answer).trim())
      .filter(Boolean);

    if (cleanedAnswers.length === 0) {
      throw new Error("Câu trả lời ngắn phải có ít nhất 1 đáp án chấp nhận");
    }
  }
}

function normalizeQuestionPayload(question, orderIndex) {
  validateQuestionPayload(question);

  const point = getQuestionPoint(question.type);

  const baseData = {
    type: question.type,
    questionText: question.questionText.trim(),
    orderIndex,
    point,
  };

  if (question.type === QUESTION_TYPES.SINGLE_CHOICE) {
    return {
      ...baseData,
      options: question.options.map((option) => ({
        key: option.key,
        text: option.text.trim(),
      })),
      correctOption: question.correctOption,
      statements: [],
      acceptedAnswers: [],
    };
  }

  if (question.type === QUESTION_TYPES.TRUE_FALSE_GROUP) {
    return {
      ...baseData,
      options: [],
      correctOption: "",
      statements: question.statements.map((statement) => ({
        key: statement.key,
        text: statement.text.trim(),
        correctBoolean: statement.correctBoolean,
      })),
      acceptedAnswers: [],
    };
  }

  return {
    ...baseData,
    options: [],
    correctOption: "",
    statements: [],
    acceptedAnswers: question.acceptedAnswers
      .map((answer) => String(answer).trim())
      .filter(Boolean),
    shortAnswerConfig: {
      caseSensitive: Boolean(question.shortAnswerConfig?.caseSensitive),
      trimSpaces: question.shortAnswerConfig?.trimSpaces !== false,
    },
  };
}

async function recalculateQuizSummary(quizId) {
  const questions = await QuizQuestion.find({
    quizId,
  });

  const questionCount = questions.length;
  const totalPoint = questions.reduce((sum, question) => {
    return sum + Number(question.point || 0);
  }, 0);

  await Quiz.findByIdAndUpdate(quizId, {
    questionCount,
    totalPoint,
  });

  return {
    questionCount,
    totalPoint,
  };
}

export async function createManualQuiz(req, res) {
  try {
    const { classId } = req.params;
    const { title, description, durationMinutes, lessonId, questions = [] } =
      req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập tên bài kiểm tra",
      });
    }

    if (!durationMinutes || Number(durationMinutes) <= 0) {
      return res.status(400).json({
        message: "Vui lòng nhập thời gian làm bài hợp lệ",
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "Bài kiểm tra phải có ít nhất 1 câu hỏi",
      });
    }

    const { classRoom, error } = await checkClassPermission(classId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (lessonId) {
      const lesson = await Lesson.findOne({
        _id: lessonId,
        classId: classRoom._id,
      });

      if (!lesson) {
        return res.status(400).json({
          message: "Bài học được chọn không thuộc lớp này",
        });
      }
    }

    const normalizedQuestions = questions.map((question, index) =>
      normalizeQuestionPayload(question, index + 1)
    );

    const quiz = await Quiz.create({
      classId: classRoom._id,
      lessonId: lessonId || null,
      createdBy: req.user._id,
      title: title.trim(),
      description: description || "",
      durationMinutes: Number(durationMinutes),
      status: "INACTIVE",
      creationMode: "MANUAL",
      questionCount: 0,
      totalPoint: 0,
      submissionCount: 0,
      isLocked: false,
    });

    const createdQuestions = await QuizQuestion.create(
      normalizedQuestions.map((question) => ({
        ...question,
        quizId: quiz._id,
        classId: classRoom._id,
      }))
    );

    const summary = await recalculateQuizSummary(quiz._id);

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      quiz._id,
      {
        questionCount: summary.questionCount,
        totalPoint: summary.totalPoint,
      },
      {
        new: true,
      }
    );

    return res.status(201).json({
      message: "Tạo bài kiểm tra thành công. Bài đang ở trạng thái chưa kích hoạt.",
      quiz: {
        id: updatedQuiz._id.toString(),
        title: updatedQuiz.title,
        description: updatedQuiz.description,
        durationMinutes: updatedQuiz.durationMinutes,
        status: updatedQuiz.status,
        questionCount: updatedQuiz.questionCount,
        totalPoint: updatedQuiz.totalPoint,
        isLocked: updatedQuiz.isLocked,
      },
      questions: createdQuestions.map((question) => ({
        id: question._id.toString(),
        type: question.type,
        questionText: question.questionText,
        point: question.point,
        orderIndex: question.orderIndex,
      })),
    });
  } catch (error) {
    console.error("Create manual quiz error:", error);

    return res.status(500).json({
      message: error.message || "Lỗi server khi tạo bài kiểm tra",
    });
  }
}

export async function getClassQuizzes(req, res) {
  try {
    const { classId } = req.params;

    const { error } = await checkClassPermission(classId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const quizzes = await Quiz.find({
      classId,
      status: {
        $ne: "ARCHIVED",
      },
    })
      .populate("lessonId", "title")
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

    const rows = await Promise.all(
      quizzes.map(async (quiz) => {
        const submissionCount = await QuizSubmission.countDocuments({
          quizId: quiz._id,
        });

        if (
          quiz.submissionCount !== submissionCount ||
          quiz.isLocked !== submissionCount > 0
        ) {
          quiz.submissionCount = submissionCount;
          quiz.isLocked = submissionCount > 0;
          await quiz.save();
        }

        return {
          id: quiz._id.toString(),
          title: quiz.title,
          description: quiz.description,
          lessonTitle: quiz.lessonId?.title || "",
          durationMinutes: quiz.durationMinutes,
          questionCount: quiz.questionCount,
          totalPoint: quiz.totalPoint,
          status: quiz.status,
          creationMode: quiz.creationMode,
          submissionCount,
          isLocked: submissionCount > 0,
          createdBy: quiz.createdBy?.fullName || "",
          createdAt: quiz.createdAt,
        };
      })
    );

    return res.json({
      quizzes: rows,
    });
  } catch (error) {
    console.error("Get class quizzes error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách bài kiểm tra",
    });
  }
}

export async function getQuizDetail(req, res) {
  try {
    const { quizId } = req.params;

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
    }).sort({ orderIndex: 1 });

    const submissionCount = await QuizSubmission.countDocuments({
      quizId: quiz._id,
    });

    return res.json({
      quiz: {
        id: quiz._id.toString(),
        classId: quiz.classId.toString(),
        lessonId: quiz.lessonId?.toString() || "",
        title: quiz.title,
        description: quiz.description,
        durationMinutes: quiz.durationMinutes,
        questionCount: quiz.questionCount,
        totalPoint: quiz.totalPoint,
        status: quiz.status,
        submissionCount,
        isLocked: submissionCount > 0,
        canEdit: submissionCount === 0,
      },
      questions: questions.map((question) => ({
        id: question._id.toString(),
        type: question.type,
        questionText: question.questionText,
        orderIndex: question.orderIndex,
        point: question.point,
        options: question.options,
        correctOption: question.correctOption,
        statements: question.statements,
        acceptedAnswers: question.acceptedAnswers,
        shortAnswerConfig: question.shortAnswerConfig,
      })),
    });
  } catch (error) {
    console.error("Get quiz detail error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy chi tiết bài kiểm tra",
    });
  }
}

export async function updateQuizBasic(req, res) {
  try {
    const { quizId } = req.params;
    const { title, description, durationMinutes, lessonId } = req.body;

    const { quiz, classRoom, error } = await checkQuizPermission(
      quizId,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const editCheck = await ensureQuizEditable(quiz._id);

    if (!editCheck.canEdit) {
      return res.status(400).json({
        message: editCheck.message,
      });
    }

    if (lessonId) {
      const lesson = await Lesson.findOne({
        _id: lessonId,
        classId: classRoom._id,
      });

      if (!lesson) {
        return res.status(400).json({
          message: "Bài học được chọn không thuộc lớp này",
        });
      }

      quiz.lessonId = lessonId;
    } else if (lessonId === null || lessonId === "") {
      quiz.lessonId = null;
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          message: "Tên bài kiểm tra không được để trống",
        });
      }

      quiz.title = title.trim();
    }

    if (description !== undefined) {
      quiz.description = description;
    }

    if (durationMinutes !== undefined) {
      if (Number(durationMinutes) <= 0) {
        return res.status(400).json({
          message: "Thời gian làm bài không hợp lệ",
        });
      }

      quiz.durationMinutes = Number(durationMinutes);
    }

    await quiz.save();

    return res.json({
      message: "Cập nhật bài kiểm tra thành công",
      quiz,
    });
  } catch (error) {
    console.error("Update quiz error:", error);

    return res.status(500).json({
      message: "Lỗi server khi cập nhật bài kiểm tra",
    });
  }
}

export async function updateQuizStatus(req, res) {
  try {
    const { quizId } = req.params;
    const { status } = req.body;

    if (!QUIZ_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Trạng thái bài kiểm tra không hợp lệ",
      });
    }

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (status === "ACTIVE" && quiz.questionCount <= 0) {
      return res.status(400).json({
        message: "Bài kiểm tra phải có ít nhất 1 câu hỏi mới được kích hoạt",
      });
    }

    quiz.status = status;

    if (status === "ACTIVE") {
      quiz.activatedAt = new Date();
    }

    if (status === "PAUSED") {
      quiz.pausedAt = new Date();
    }

    await quiz.save();

    return res.json({
      message:
        status === "ACTIVE"
          ? "Đã kích hoạt bài kiểm tra"
          : status === "INACTIVE"
            ? "Đã tắt kích hoạt bài kiểm tra"
            : status === "PAUSED"
              ? "Đã tạm dừng bài kiểm tra"
              : "Đã lưu trữ bài kiểm tra",
      quiz,
    });
  } catch (error) {
    console.error("Update quiz status error:", error);

    return res.status(500).json({
      message: "Lỗi server khi cập nhật trạng thái bài kiểm tra",
    });
  }
}

export async function addQuizQuestion(req, res) {
  try {
    const { quizId } = req.params;

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const editCheck = await ensureQuizEditable(quiz._id);

    if (!editCheck.canEdit) {
      return res.status(400).json({
        message: editCheck.message,
      });
    }

    const currentCount = await QuizQuestion.countDocuments({
      quizId: quiz._id,
    });

    const normalizedQuestion = normalizeQuestionPayload(
      req.body,
      currentCount + 1
    );

    const question = await QuizQuestion.create({
      ...normalizedQuestion,
      quizId: quiz._id,
      classId: quiz.classId,
    });

    await recalculateQuizSummary(quiz._id);

    return res.status(201).json({
      message: "Thêm câu hỏi thành công",
      question,
    });
  } catch (error) {
    console.error("Add quiz question error:", error);

    return res.status(500).json({
      message: error.message || "Lỗi server khi thêm câu hỏi",
    });
  }
}

export async function updateQuizQuestion(req, res) {
  try {
    const { quizId, questionId } = req.params;

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const editCheck = await ensureQuizEditable(quiz._id);

    if (!editCheck.canEdit) {
      return res.status(400).json({
        message: editCheck.message,
      });
    }

    const question = await QuizQuestion.findOne({
      _id: questionId,
      quizId: quiz._id,
    });

    if (!question) {
      return res.status(404).json({
        message: "Không tìm thấy câu hỏi",
      });
    }

    const normalizedQuestion = normalizeQuestionPayload(
      req.body,
      question.orderIndex
    );

    Object.assign(question, normalizedQuestion);

    await question.save();
    await recalculateQuizSummary(quiz._id);

    return res.json({
      message: "Cập nhật câu hỏi thành công",
      question,
    });
  } catch (error) {
    console.error("Update quiz question error:", error);

    return res.status(500).json({
      message: error.message || "Lỗi server khi cập nhật câu hỏi",
    });
  }
}

export async function deleteQuizQuestion(req, res) {
  try {
    const { quizId, questionId } = req.params;

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const editCheck = await ensureQuizEditable(quiz._id);

    if (!editCheck.canEdit) {
      return res.status(400).json({
        message: editCheck.message,
      });
    }

    const question = await QuizQuestion.findOne({
      _id: questionId,
      quizId: quiz._id,
    });

    if (!question) {
      return res.status(404).json({
        message: "Không tìm thấy câu hỏi",
      });
    }

    await question.deleteOne();

    const remainingQuestions = await QuizQuestion.find({
      quizId: quiz._id,
    }).sort({ orderIndex: 1 });

    for (let index = 0; index < remainingQuestions.length; index += 1) {
      remainingQuestions[index].orderIndex = index + 1;
      await remainingQuestions[index].save();
    }

    await recalculateQuizSummary(quiz._id);

    return res.json({
      message: "Xóa câu hỏi thành công",
    });
  } catch (error) {
    console.error("Delete quiz question error:", error);

    return res.status(500).json({
      message: "Lỗi server khi xóa câu hỏi",
    });
  }
}

async function checkStudentClassAccess(classId, user) {
  if (user.role !== "STUDENT") {
    return {
      error: {
        status: 403,
        message: "Chỉ học sinh mới được dùng chức năng này",
      },
    };
  }

  const enrollment = await Enrollment.findOne({
    classId,
    studentId: user._id,
    status: "ACTIVE",
  });

  if (!enrollment) {
    return {
      error: {
        status: 403,
        message: "Bạn chưa được tham gia lớp học này",
      },
    };
  }

  return {
    enrollment,
  };
}

function buildStudentQuestion(question) {
  const base = {
    id: question._id.toString(),
    type: question.type,
    questionText: question.questionText,
    orderIndex: question.orderIndex,
    point: question.point,
  };

  if (question.type === "SINGLE_CHOICE") {
    return {
      ...base,
      options: question.options,
    };
  }

  if (question.type === "TRUE_FALSE_GROUP") {
    return {
      ...base,
      statements: question.statements.map((statement) => ({
        key: statement.key,
        text: statement.text,
      })),
    };
  }

  return base;
}

function normalizeShortAnswer(value, config = {}) {
  let result = String(value || "");

  if (config.trimSpaces !== false) {
    result = result.trim().replace(/\s+/g, " ");
  }

  if (!config.caseSensitive) {
    result = result.toLowerCase();
  }

  return result;
}

function getSubmittedAnswer(answers, questionId) {
  if (!Array.isArray(answers)) return {};

  return (
    answers.find((answer) => answer.questionId?.toString() === questionId.toString()) ||
    {}
  );
}

function gradeQuestion(question, submittedAnswer) {
  if (question.type === "SINGLE_CHOICE") {
    const selectedOption = submittedAnswer.selectedOption || "";
    const isCorrect = selectedOption === question.correctOption;

    return {
      selectedOption,
      selectedTrueFalseAnswers: [],
      shortAnswerText: "",
      correctAnswerSnapshot: {
        correctOption: question.correctOption,
      },
      isCorrect,
      pointEarned: isCorrect ? question.point : 0,
      maxPoint: question.point,
    };
  }

  if (question.type === "TRUE_FALSE_GROUP") {
    const selectedTrueFalseAnswers = Array.isArray(
      submittedAnswer.selectedTrueFalseAnswers
    )
      ? submittedAnswer.selectedTrueFalseAnswers
      : [];

    const correctMap = new Map(
      question.statements.map((statement) => [
        statement.key,
        statement.correctBoolean,
      ])
    );

    let correctItemCount = 0;

    const normalizedSelected = ["A", "B", "C", "D"].map((key) => {
      const selectedItem = selectedTrueFalseAnswers.find(
        (item) => item.key === key
      );

      const value =
        typeof selectedItem?.value === "boolean" ? selectedItem.value : null;

      if (value === correctMap.get(key)) {
        correctItemCount += 1;
      }

      return {
        key,
        value,
      };
    });

    const pointEarned = correctItemCount * 0.25;

    return {
      selectedOption: "",
      selectedTrueFalseAnswers: normalizedSelected,
      shortAnswerText: "",
      correctAnswerSnapshot: {
        correctTrueFalseAnswers: question.statements.map((statement) => ({
          key: statement.key,
          value: statement.correctBoolean,
        })),
      },
      isCorrect: correctItemCount === 4,
      pointEarned,
      maxPoint: question.point,
    };
  }

  const shortAnswerText = submittedAnswer.shortAnswerText || "";

  const studentAnswer = normalizeShortAnswer(
    shortAnswerText,
    question.shortAnswerConfig
  );

  const acceptedAnswers = question.acceptedAnswers.map((answer) =>
    normalizeShortAnswer(answer, question.shortAnswerConfig)
  );

  const isCorrect = acceptedAnswers.includes(studentAnswer);

  return {
    selectedOption: "",
    selectedTrueFalseAnswers: [],
    shortAnswerText,
    correctAnswerSnapshot: {
      acceptedAnswers: question.acceptedAnswers,
    },
    isCorrect,
    pointEarned: isCorrect ? question.point : 0,
    maxPoint: question.point,
  };
}

function buildQuestionSnapshot(question) {
  return {
    type: question.type,
    questionText: question.questionText,
    options: question.options,
    statements: question.statements,
    point: question.point,
  };
}

export async function getStudentClassQuizzes(req, res) {
  try {
    const { classId } = req.params;

    const { error } = await checkStudentClassAccess(classId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const quizzes = await Quiz.find({
      classId,
      status: {
        $ne: "ARCHIVED",
      },
    }).sort({ createdAt: -1 });

    const submissions = await QuizSubmission.find({
      classId,
      studentId: req.user._id,
    });

    const submissionMap = new Map(
      submissions.map((submission) => [
        submission.quizId.toString(),
        submission,
      ])
    );

    return res.json({
      quizzes: quizzes.map((quiz) => {
        const submission = submissionMap.get(quiz._id.toString());

        return {
          id: quiz._id.toString(),
          title: quiz.title,
          description: quiz.description,
          durationMinutes: quiz.durationMinutes,
          questionCount: quiz.questionCount,
          totalPoint: quiz.totalPoint,
          status: quiz.status,
          canStart: quiz.status === "ACTIVE" && !submission,
          submissionStatus: submission?.status || "",
          score: submission?.score ?? null,
          submittedAt: submission?.submittedAt || null,
          createdAt: quiz.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("Get student quizzes error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách bài kiểm tra",
    });
  }
}

export async function startStudentQuiz(req, res) {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy bài kiểm tra",
      });
    }

    const { error } = await checkStudentClassAccess(quiz.classId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (quiz.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Bài kiểm tra chưa được kích hoạt",
      });
    }

    let submission = await QuizSubmission.findOne({
      quizId: quiz._id,
      studentId: req.user._id,
    });

    if (submission?.status === "SUBMITTED" || submission?.status === "AUTO_SUBMITTED") {
      return res.status(400).json({
        message: "Bạn đã nộp bài kiểm tra này",
      });
    }

    if (!submission) {
      submission = await QuizSubmission.create({
        quizId: quiz._id,
        classId: quiz.classId,
        studentId: req.user._id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        totalPoint: quiz.totalPoint,
        questionCount: quiz.questionCount,
      });

      await Quiz.findByIdAndUpdate(quiz._id, {
        isLocked: true,
        $inc: {
          submissionCount: 1,
        },
      });
    }

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
    }).sort({ orderIndex: 1 });

    return res.json({
      message: "Bắt đầu làm bài",
      quiz: {
        id: quiz._id.toString(),
        classId: quiz.classId.toString(),
        title: quiz.title,
        description: quiz.description,
        durationMinutes: quiz.durationMinutes,
        questionCount: quiz.questionCount,
        totalPoint: quiz.totalPoint,
        startedAt: submission.startedAt,
      },
      questions: questions.map(buildStudentQuestion),
    });
  } catch (error) {
    console.error("Start student quiz error:", error);

    return res.status(500).json({
      message: "Lỗi server khi bắt đầu làm bài",
    });
  }
}

export async function submitStudentQuiz(req, res) {
  try {
    const { quizId } = req.params;
    const { answers = [] } = req.body;

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy bài kiểm tra",
      });
    }

    const { error } = await checkStudentClassAccess(quiz.classId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const submission = await QuizSubmission.findOne({
      quizId: quiz._id,
      studentId: req.user._id,
    });

    if (!submission) {
      return res.status(400).json({
        message: "Bạn chưa bắt đầu làm bài",
      });
    }

    if (submission.status === "SUBMITTED" || submission.status === "AUTO_SUBMITTED") {
      return res.status(400).json({
        message: "Bạn đã nộp bài kiểm tra này",
      });
    }

    const questions = await QuizQuestion.find({
      quizId: quiz._id,
    }).sort({ orderIndex: 1 });

    const checkedAnswers = questions.map((question) => {
      const submittedAnswer = getSubmittedAnswer(answers, question._id);

      const graded = gradeQuestion(question, submittedAnswer);

      return {
        questionId: question._id,
        questionSnapshot: buildQuestionSnapshot(question),
        selectedOption: graded.selectedOption,
        selectedTrueFalseAnswers: graded.selectedTrueFalseAnswers,
        shortAnswerText: graded.shortAnswerText,
        correctAnswerSnapshot: graded.correctAnswerSnapshot,
        isCorrect: graded.isCorrect,
        pointEarned: graded.pointEarned,
        maxPoint: graded.maxPoint,
      };
    });

    const score = checkedAnswers.reduce((sum, answer) => {
      return sum + Number(answer.pointEarned || 0);
    }, 0);

    submission.answers = checkedAnswers;
    submission.score = score;
    submission.totalPoint = quiz.totalPoint;
    submission.questionCount = quiz.questionCount;
    submission.status = "SUBMITTED";
    submission.submittedAt = new Date();

    await submission.save();

    return res.json({
      message: "Nộp bài thành công",
      result: {
        quizId: quiz._id.toString(),
        classId: quiz.classId.toString(),
        score,
        totalPoint: quiz.totalPoint,
        questionCount: quiz.questionCount,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error("Submit quiz error:", error);

    return res.status(500).json({
      message: "Lỗi server khi nộp bài",
    });
  }
}

export async function getStudentQuizResult(req, res) {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy bài kiểm tra",
      });
    }

    const { error } = await checkStudentClassAccess(quiz.classId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const submission = await QuizSubmission.findOne({
      quizId: quiz._id,
      studentId: req.user._id,
    });

    if (!submission || submission.status === "IN_PROGRESS") {
      return res.status(400).json({
        message: "Bạn chưa nộp bài kiểm tra này",
      });
    }

    return res.json({
      quiz: {
        id: quiz._id.toString(),
        classId: quiz.classId.toString(),
        title: quiz.title,
        totalPoint: quiz.totalPoint,
      },
      result: {
        score: submission.score,
        totalPoint: submission.totalPoint,
        questionCount: submission.questionCount,
        submittedAt: submission.submittedAt,
        answers: submission.answers,
      },
    });
  } catch (error) {
    console.error("Get quiz result error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy kết quả bài kiểm tra",
    });
  }
}

export async function getQuizSubmissions(req, res) {
  try {
    const { quizId } = req.params;

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const enrollments = await Enrollment.find({
      classId: quiz.classId,
      status: "ACTIVE",
    }).populate("studentId", "fullName email");

    const submissions = await QuizSubmission.find({
      quizId: quiz._id,
    }).populate("studentId", "fullName email");

    const submissionMap = new Map(
      submissions.map((submission) => [
        submission.studentId?._id?.toString() || submission.studentId?.toString(),
        submission,
      ])
    );

    const rows = enrollments.map((enrollment) => {
      const student = enrollment.studentId;
      const submission = submissionMap.get(student._id.toString());

      return {
        studentId: student._id.toString(),
        studentName: student.fullName,
        studentEmail: student.email,

        submissionId: submission?._id?.toString() || "",
        submissionStatus: submission?.status || "NOT_STARTED",

        score: submission?.score ?? null,
        totalPoint: submission?.totalPoint ?? quiz.totalPoint,
        questionCount: submission?.questionCount ?? quiz.questionCount,

        violationCount: submission?.violationCount || 0,
        startedAt: submission?.startedAt || null,
        submittedAt: submission?.submittedAt || null,

        canViewDetail:
          Boolean(submission) &&
          ["SUBMITTED", "AUTO_SUBMITTED"].includes(submission.status),
      };
    });

    return res.json({
      quiz: {
        id: quiz._id.toString(),
        title: quiz.title,
        totalPoint: quiz.totalPoint,
        questionCount: quiz.questionCount,
        status: quiz.status,
      },
      submissions: rows,
    });
  } catch (error) {
    console.error("Get quiz submissions error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách kết quả bài kiểm tra",
    });
  }
}

export async function getQuizSubmissionDetail(req, res) {
  try {
    const { quizId, submissionId } = req.params;

    const { quiz, error } = await checkQuizPermission(quizId, req.user);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const submission = await QuizSubmission.findOne({
      _id: submissionId,
      quizId: quiz._id,
    }).populate("studentId", "fullName email");

    if (!submission) {
      return res.status(404).json({
        message: "Không tìm thấy bài làm của học sinh",
      });
    }

    return res.json({
      quiz: {
        id: quiz._id.toString(),
        title: quiz.title,
        totalPoint: quiz.totalPoint,
        questionCount: quiz.questionCount,
      },
      student: {
        id: submission.studentId._id.toString(),
        name: submission.studentId.fullName,
        email: submission.studentId.email,
      },
      submission: {
        id: submission._id.toString(),
        status: submission.status,
        score: submission.score,
        totalPoint: submission.totalPoint,
        questionCount: submission.questionCount,
        violationCount: submission.violationCount,
        violations: submission.violations,
        startedAt: submission.startedAt,
        submittedAt: submission.submittedAt,
        answers: submission.answers,
      },
    });
  } catch (error) {
    console.error("Get quiz submission detail error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy chi tiết bài làm",
    });
  }
}