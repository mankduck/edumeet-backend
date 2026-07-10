import ClassRoom from "../models/ClassRoom.js";
import Enrollment from "../models/Enrollment.js";
import Lesson from "../models/Lesson.js";
import MeetSession from "../models/MeetSession.js";
import User from "../models/User.js";

async function getAdminDashboard(req, res) {
  const [teacherCount, studentCount, classCount, lessonCount] =
    await Promise.all([
      User.countDocuments({ role: "TEACHER" }),
      User.countDocuments({ role: "STUDENT" }),
      ClassRoom.countDocuments({}),
      Lesson.countDocuments({}),
    ]);

  const classes = await ClassRoom.find({})
    .populate("teacherId", "fullName email")
    .populate("subjectId", "name")
    .sort({ createdAt: -1 })
    .limit(6);

  const classRows = await Promise.all(
    classes.map(async (classRoom) => {
      const [studentCount, lessonCount] = await Promise.all([
        Enrollment.countDocuments({
          classId: classRoom._id,
          status: "ACTIVE",
        }),
        Lesson.countDocuments({
          classId: classRoom._id,
        }),
      ]);

      return {
        id: classRoom._id.toString(),
        name: classRoom.name,
        subject: classRoom.subjectId?.name || "Không rõ",
        teacher: classRoom.teacherId?.fullName || "Chưa phân công",
        students: studentCount,
        lessons: lessonCount,
        status: classRoom.status,
      };
    })
  );

  const teachers = await User.find({ role: "TEACHER" })
    .populate("subjectId", "name")
    .select("fullName email subjectId")
    .sort({ createdAt: -1 })
    .limit(5);

  const teacherRows = await Promise.all(
    teachers.map(async (teacher) => {
      const classCount = await ClassRoom.countDocuments({
        teacherId: teacher._id,
      });

      return {
        id: teacher._id.toString(),
        name: teacher.fullName,
        email: teacher.email,
        subject: teacher.subjectId?.name || "Chưa phân môn",
        classCount,
      };
    })
  );

  const recentMeetings = await MeetSession.find({})
    .populate("teacherId", "fullName")
    .populate("classId", "name")
    .sort({ startAt: 1 })
    .limit(5);

  return res.json({
    role: "admin",
    stats: {
      teacherCount,
      studentCount,
      classCount,
      lessonCount,
    },
    classes: classRows,
    teachers: teacherRows,
    recentMeetings: recentMeetings.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      teacher: item.teacherId?.fullName || "Không rõ",
      className: item.classId?.name || "Không rõ",
      startAt: item.startAt,
      meetUrl: item.meetUrl,
      status: item.status,
    })),
  });
}

async function getTeacherDashboard(req, res) {
  const myClasses = await ClassRoom.find({
    teacherId: req.user._id,
  })
    .populate("subjectId", "name")
    .sort({ createdAt: -1 });

  const classIds = myClasses.map((item) => item._id);

  const [studentCount, lessonCount, meetCount] = await Promise.all([
    Enrollment.countDocuments({
      classId: { $in: classIds },
      status: "ACTIVE",
    }),
    Lesson.countDocuments({
      classId: { $in: classIds },
    }),
    MeetSession.countDocuments({
      classId: { $in: classIds },
    }),
  ]);

  const enrollments = await Enrollment.find({
    classId: { $in: classIds },
    status: "ACTIVE",
  })
    .populate("studentId", "fullName email facebookUrl")
    .populate("classId", "name")
    .sort({ createdAt: -1 });

  const lessons = await Lesson.find({
    classId: { $in: classIds },
  })
    .populate("classId", "name")
    .sort({ orderIndex: 1, createdAt: -1 })
    .limit(5);

  const recentMeetings = await MeetSession.find({
    classId: { $in: classIds },
  })
    .populate("classId", "name")
    .sort({ startAt: 1 })
    .limit(5);

  return res.json({
    role: "teacher",
    subject: {
      id: req.user.subjectId?._id?.toString() || req.user.subjectId?.toString(),
      name: req.user.subjectId?.name || "",
    },
    stats: {
      classCount: myClasses.length,
      studentCount,
      lessonCount,
      meetCount,
    },
    classes: myClasses.map((classRoom) => ({
      id: classRoom._id.toString(),
      name: classRoom.name,
      subject: classRoom.subjectId?.name || "",
      grade: classRoom.grade,
      description: classRoom.description,
      status: classRoom.status,
    })),
    students: enrollments.map((item) => ({
      id: item.studentId._id.toString(),
      name: item.studentId.fullName,
      email: item.studentId.email,
      facebookUrl: item.studentId.facebookUrl || "",
      className: item.classId?.name || "",
    })),
    lessons: lessons.map((lesson) => ({
      id: lesson._id.toString(),
      title: lesson.title,
      description: lesson.description,
      className: lesson.classId?.name || "",
      orderIndex: lesson.orderIndex,
      status: lesson.status,
    })),
    recentMeetings: recentMeetings.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      className: item.classId?.name || "",
      startAt: item.startAt,
      meetUrl: item.meetUrl,
      status: item.status,
    })),
  });
}

export async function getDashboard(req, res) {
  try {
    if (req.user.role === "ADMIN") {
      return getAdminDashboard(req, res);
    }

    if (req.user.role === "TEACHER") {
      return getTeacherDashboard(req, res);
    }

    return res.status(403).json({
      message: "Bạn không có quyền truy cập dashboard này",
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy dữ liệu dashboard",
    });
  }
}