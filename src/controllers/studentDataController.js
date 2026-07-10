import ClassRoom from "../models/ClassRoom.js";
import Enrollment from "../models/Enrollment.js";
import Lesson from "../models/Lesson.js";
import LessonFile from "../models/LessonFile.js";
import MeetSession from "../models/MeetSession.js";

async function getActiveStudentClassIds(studentId) {
  const enrollments = await Enrollment.find({
    studentId,
    status: "ACTIVE",
  }).select("classId");

  return enrollments.map((item) => item.classId);
}

export async function getStudentDashboard(req, res) {
  try {
    const classIds = await getActiveStudentClassIds(req.user._id);

    const [classCount, lessonCount, meetCount] = await Promise.all([
      ClassRoom.countDocuments({
        _id: { $in: classIds },
        status: "ACTIVE",
      }),
      Lesson.countDocuments({
        classId: { $in: classIds },
        status: "PUBLISHED",
      }),
      MeetSession.countDocuments({
        classId: { $in: classIds },
        status: "SCHEDULED",
      }),
    ]);

    const classes = await ClassRoom.find({
      _id: { $in: classIds },
      status: "ACTIVE",
    })
      .populate("subjectId", "name")
      .populate("teacherId", "fullName email")
      .sort({ createdAt: -1 })
      .limit(4);

    const meetSessions = await MeetSession.find({
      classId: { $in: classIds },
      status: "SCHEDULED",
    })
      .populate("classId", "name")
      .populate("lessonId", "title")
      .sort({ createdAt: -1 })
      .limit(4);

    return res.json({
      stats: {
        classCount,
        lessonCount,
        meetCount,
      },
      classes: classes.map((classRoom) => ({
        id: classRoom._id.toString(),
        name: classRoom.name,
        subject: classRoom.subjectId?.name || "",
        teacher: classRoom.teacherId?.fullName || "",
        teacherEmail: classRoom.teacherId?.email || "",
        description: classRoom.description,
        status: classRoom.status,
      })),
      meetSessions: meetSessions.map((session) => ({
        id: session._id.toString(),
        title: session.title,
        className: session.classId?.name || "",
        lessonTitle: session.lessonId?.title || "",
        meetUrl: session.meetUrl,
        startAt: session.startAt,
        endAt: session.endAt,
        status: session.status,
      })),
    });
  } catch (error) {
    console.error("Get student dashboard error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy tổng quan học sinh",
    });
  }
}

export async function getStudentClasses(req, res) {
  try {
    const classIds = await getActiveStudentClassIds(req.user._id);

    const classes = await ClassRoom.find({
      _id: { $in: classIds },
      status: "ACTIVE",
    })
      .populate("subjectId", "name")
      .populate("teacherId", "fullName email")
      .sort({ createdAt: -1 });

    const rows = await Promise.all(
      classes.map(async (classRoom) => {
        const [lessonCount, meetCount] = await Promise.all([
          Lesson.countDocuments({
            classId: classRoom._id,
            status: "PUBLISHED",
          }),
          MeetSession.countDocuments({
            classId: classRoom._id,
            status: "SCHEDULED",
          }),
        ]);

        return {
          id: classRoom._id.toString(),
          name: classRoom.name,
          grade: classRoom.grade,
          subject: classRoom.subjectId?.name || "",
          teacher: classRoom.teacherId?.fullName || "",
          teacherEmail: classRoom.teacherId?.email || "",
          description: classRoom.description,
          status: classRoom.status,
          lessonCount,
          meetCount,
        };
      })
    );

    return res.json({
      classes: rows,
    });
  } catch (error) {
    console.error("Get student classes error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách lớp của học sinh",
    });
  }
}

export async function getStudentClassDetail(req, res) {
  try {
    const { classId } = req.params;

    const enrollment = await Enrollment.findOne({
      classId,
      studentId: req.user._id,
      status: "ACTIVE",
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "Bạn không có quyền truy cập lớp học này",
      });
    }

    const classRoom = await ClassRoom.findById(classId)
      .populate("subjectId", "name")
      .populate("teacherId", "fullName email");

    if (!classRoom || classRoom.status !== "ACTIVE") {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
      });
    }

    const lessons = await Lesson.find({
      classId,
      status: "PUBLISHED",
    }).sort({ orderIndex: 1, createdAt: -1 });

    const lessonRows = await Promise.all(
      lessons.map(async (lesson) => {
        const files = await LessonFile.find({
          lessonId: lesson._id,
        }).sort({ createdAt: -1 });

        return {
          id: lesson._id.toString(),
          title: lesson.title,
          description: lesson.description,
          orderIndex: lesson.orderIndex,
          status: lesson.status,
          files: files.map((file) => ({
            id: file._id.toString(),
            fileName: file.fileName,
            originalName: file.originalName,
            fileType: file.fileType,
            fileUrl: file.fileUrl,
            downloadUrl:
              file.downloadUrl ||
              `https://drive.google.com/uc?export=download&id=${file.googleDriveFileId}`,
            mimeType: file.mimeType,
            size: file.size,
          })),
        };
      })
    );

    const meetSessions = await MeetSession.find({
      classId,
      status: "SCHEDULED",
    })
      .populate("lessonId", "title")
      .sort({ createdAt: -1 });

    return res.json({
      classRoom: {
        id: classRoom._id.toString(),
        name: classRoom.name,
        grade: classRoom.grade,
        subject: classRoom.subjectId?.name || "",
        teacher: classRoom.teacherId?.fullName || "",
        teacherEmail: classRoom.teacherId?.email || "",
        description: classRoom.description,
        status: classRoom.status,
      },
      lessons: lessonRows,
      meetSessions: meetSessions.map((session) => ({
        id: session._id.toString(),
        title: session.title,
        description: session.description,
        lessonTitle: session.lessonId?.title || "",
        meetUrl: session.meetUrl,
        startAt: session.startAt,
        endAt: session.endAt,
        status: session.status,
      })),
    });
  } catch (error) {
    console.error("Get student class detail error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy chi tiết lớp học",
    });
  }
}

export async function getStudentMeetSessions(req, res) {
  try {
    const classIds = await getActiveStudentClassIds(req.user._id);

    const sessions = await MeetSession.find({
      classId: { $in: classIds },
      status: "SCHEDULED",
    })
      .populate("classId", "name")
      .populate("lessonId", "title")
      .populate("teacherId", "fullName email")
      .sort({ createdAt: -1 });

    return res.json({
      sessions: sessions.map((session) => ({
        id: session._id.toString(),
        title: session.title,
        description: session.description,
        className: session.classId?.name || "",
        lessonTitle: session.lessonId?.title || "",
        teacher: session.teacherId?.fullName || "",
        teacherEmail: session.teacherId?.email || "",
        meetUrl: session.meetUrl,
        startAt: session.startAt,
        endAt: session.endAt,
        status: session.status,
      })),
    });
  } catch (error) {
    console.error("Get student meet sessions error:", error);

    return res.status(500).json({
      message: "Lỗi server khi lấy lịch Google Meet",
    });
  }
}

