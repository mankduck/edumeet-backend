import ClassRoom from "../models/ClassRoom.js";
import Enrollment from "../models/Enrollment.js";
import Lesson from "../models/Lesson.js";
import LessonFile from "../models/LessonFile.js";
import MeetSession from "../models/MeetSession.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import {
  createGoogleMeetEvent,
} from "../services/googleCalendarService.js";
import Notification from "../models/Notification.js";
import bcrypt from "bcryptjs";

async function getVisibleClassIds(user) {
    if (user.role === "ADMIN") return null;

    const classes = await ClassRoom.find({
        teacherId: user._id,
    }).select("_id");

    return classes.map((item) => item._id);
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

function buildSearchQuery(keyword, fields = []) {
    const q = keyword?.trim();

    if (!q) return {};

    return {
        $or: fields.map((field) => ({
            [field]: {
                $regex: q,
                $options: "i",
            },
        })),
    };
}

function requireAdmin(req, res) {
    if (req.user.role !== "ADMIN") {
        res.status(403).json({
            message: "Chỉ admin mới có quyền dùng chức năng này",
        });

        return false;
    }

    return true;
}

export async function getClassesPage(req, res) {
    try {
        const query =
            req.user.role === "ADMIN" ? {} : { teacherId: req.user._id };

        const classes = await ClassRoom.find(query)
            .populate("subjectId", "name")
            .populate("teacherId", "fullName email subjectId status")
            .sort({ createdAt: -1 });

        const rows = await Promise.all(
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
                    grade: classRoom.grade,
                    subjectId: classRoom.subjectId?._id?.toString() || "",
                    subject: classRoom.subjectId?.name || "",
                    teacherId: classRoom.teacherId?._id?.toString() || "",
                    teacher: classRoom.teacherId?.fullName || "",
                    teacherEmail: classRoom.teacherId?.email || "",
                    description: classRoom.description,
                    students: studentCount,
                    lessons: lessonCount,
                    status: classRoom.status,
                };
            })
        );

        const subjects = await Subject.find({ status: "ACTIVE" }).sort({
            name: 1,
        });

        const teachers = await User.find({
            role: "TEACHER",
            status: "ACTIVE",
            subjectId: {
                $ne: null,
            },
        })
            .populate("subjectId", "name")
            .select("fullName email subjectId")
            .sort({ fullName: 1 });

        return res.json({
            classes: rows,
            subjects: subjects.map((item) => ({
                id: item._id.toString(),
                name: item.name,
            })),
            teachers: teachers.map((teacher) => ({
                id: teacher._id.toString(),
                name: teacher.fullName,
                email: teacher.email,
                subjectId: teacher.subjectId?._id?.toString() || "",
                subjectName: teacher.subjectId?.name || "",
            })),
        });
    } catch (error) {
        console.error("Get classes error:", error);

        return res.status(500).json({
            message: "Lỗi server khi lấy danh sách lớp học",
        });
    }
}

export async function createClass(req, res) {
    try {
        const { name, grade, description, teacherId } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Vui lòng nhập tên lớp",
            });
        }

        let finalTeacherId = teacherId;
        let finalSubjectId = null;

        if (req.user.role === "TEACHER") {
            finalTeacherId = req.user._id;
            finalSubjectId = req.user.subjectId;
        }

        if (req.user.role === "ADMIN") {
            if (!finalTeacherId) {
                return res.status(400).json({
                    message: "Vui lòng chọn giáo viên phụ trách",
                });
            }

            const teacher = await User.findById(finalTeacherId);

            if (!teacher || teacher.role !== "TEACHER") {
                return res.status(400).json({
                    message: "Giáo viên không hợp lệ",
                });
            }

            if (teacher.status !== "ACTIVE") {
                return res.status(400).json({
                    message: "Giáo viên đang bị tạm đóng hoạt động",
                });
            }

            if (!teacher.subjectId) {
                return res.status(400).json({
                    message: "Giáo viên chưa được phân môn học",
                });
            }

            finalSubjectId = teacher.subjectId;
        }

        if (!finalSubjectId || !finalTeacherId) {
            return res.status(400).json({
                message: "Thiếu môn học hoặc giáo viên phụ trách",
            });
        }

        const classRoom = await ClassRoom.create({
            name,
            grade,
            description,
            subjectId: finalSubjectId,
            teacherId: finalTeacherId,
            status: "ACTIVE",
        });

        return res.status(201).json({
            message: "Tạo lớp học thành công",
            classRoom,
        });
    } catch (error) {
        console.error("Create class error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                message: "Giáo viên đã có lớp trùng tên này",
            });
        }

        return res.status(500).json({
            message: "Lỗi server khi tạo lớp học",
        });
    }
}

export async function getStudentsPage(req, res) {
    try {
        const { q = "", status = "" } = req.query;

        if (req.user.role === "ADMIN") {
            const query = {
                role: "STUDENT",
                ...buildSearchQuery(q, ["fullName", "email"]),
            };

            if (status) {
                query.status = status;
            }

            const students = await User.find(query)
                .select("fullName email phone facebookUrl status createdAt")
                .sort({ createdAt: -1 });

            const rows = await Promise.all(
                students.map(async (student) => {
                    const enrollments = await Enrollment.find({
                        studentId: student._id,
                        status: {
                            $ne: "REMOVED",
                        },
                    }).populate("classId", "name");

                    return {
                        id: student._id.toString(),
                        name: student.fullName,
                        email: student.email,
                        phone: student.phone || "",
                        facebookUrl: student.facebookUrl || "",
                        status: student.status,
                        classCount: enrollments.length,
                        classes: enrollments
                            .map((item) => item.classId?.name)
                            .filter(Boolean),
                        createdAt: student.createdAt,
                    };
                })
            );

            return res.json({
                students: rows,
            });
        }

        const classIds = await getVisibleClassIds(req.user);

        const enrollments = await Enrollment.find({
            classId: { $in: classIds },
            status: {
                $ne: "REMOVED",
            },
        })
            .populate("studentId", "fullName email facebookUrl status")
            .populate("classId", "name")
            .sort({ createdAt: -1 });

        const map = new Map();

        enrollments.forEach((enrollment) => {
            const student = enrollment.studentId;
            const key = student._id.toString();

            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    name: student.fullName,
                    email: student.email,
                    facebookUrl: student.facebookUrl || "",
                    status: student.status,
                    classCount: 0,
                    classes: [],
                });
            }

            const current = map.get(key);
            current.classCount += 1;
            current.classes.push(enrollment.classId?.name);
        });

        return res.json({
            students: Array.from(map.values()),
        });
    } catch (error) {
        console.error("Get students error:", error);

        return res.status(500).json({
            message: "Lỗi server khi lấy danh sách học sinh",
        });
    }
}

export async function getLessonsPage(req, res) {
    try {
        const {
            q = "",
            status = "",
            subjectId = "",
            classId = "",
        } = req.query;

        let visibleClassQuery = {};

        if (req.user.role === "TEACHER") {
            visibleClassQuery.teacherId = req.user._id;
        }

        if (subjectId) {
            visibleClassQuery.subjectId = subjectId;
        }

        if (classId) {
            visibleClassQuery._id = classId;
        }

        const visibleClasses = await ClassRoom.find(visibleClassQuery)
            .populate("subjectId", "name")
            .populate("teacherId", "fullName")
            .sort({ name: 1 });

        const visibleClassIds = visibleClasses.map((item) => item._id);

        const lessonQuery = {
            classId: {
                $in: visibleClassIds,
            },
            ...buildSearchQuery(q, ["title", "description"]),
        };

        if (status) {
            lessonQuery.status = status;
        }

        const lessons = await Lesson.find(lessonQuery)
            .populate({
                path: "classId",
                select: "name subjectId teacherId",
                populate: [
                    {
                        path: "subjectId",
                        select: "name",
                    },
                    {
                        path: "teacherId",
                        select: "fullName",
                    },
                ],
            })
            .sort({ createdAt: -1 });

        const rows = await Promise.all(
            lessons.map(async (lesson) => {
                const fileCount = await LessonFile.countDocuments({
                    lessonId: lesson._id,
                });

                const files = await LessonFile.find({
                    lessonId: lesson._id,
                }).sort({ createdAt: -1 });

                return {
                    id: lesson._id.toString(),
                    title: lesson.title,
                    description: lesson.description,
                    classId: lesson.classId?._id?.toString() || "",
                    className: lesson.classId?.name || "",
                    subjectId: lesson.classId?.subjectId?._id?.toString() || "",
                    subject: lesson.classId?.subjectId?.name || "",
                    teacher: lesson.classId?.teacherId?.fullName || "",
                    fileCount: files.length,
                    files: files.map((file) => ({
                        id: file._id.toString(),
                        fileName: file.fileName,
                        originalName: file.originalName,
                        fileType: file.fileType,
                        fileUrl: file.fileUrl,
                        downloadUrl:
                            file.downloadUrl ||
                            `https://drive.google.com/uc?export=download&id=${file.googleDriveFileId}`,
                        googleDriveFileId: file.googleDriveFileId,
                        mimeType: file.mimeType,
                        size: file.size,
                    })),
                    orderIndex: lesson.orderIndex,
                    status: lesson.status,
                };
            })
        );

        const subjects = await Subject.find({
            status: "ACTIVE",
        }).sort({ name: 1 });

        return res.json({
            lessons: rows,
            classes: visibleClasses.map((classRoom) => ({
                id: classRoom._id.toString(),
                name: classRoom.name,
                subjectId: classRoom.subjectId?._id?.toString() || "",
                subjectName: classRoom.subjectId?.name || "",
                teacherName: classRoom.teacherId?.fullName || "",
            })),
            subjects: subjects.map((subject) => ({
                id: subject._id.toString(),
                name: subject.name,
            })),
        });
    } catch (error) {
        console.error("Get lessons error:", error);

        return res.status(500).json({
            message: "Lỗi server khi lấy danh sách bài học",
        });
    }
}

export async function getMeetPage(req, res) {
    try {
        const classIds = await getVisibleClassIds(req.user);

        const query =
            req.user.role === "ADMIN" ? {} : { classId: { $in: classIds } };

        const sessions = await MeetSession.find(query)
            .populate("classId", "name")
            .populate("teacherId", "fullName")
            .sort({ startAt: 1 });

        const rows = await Promise.all(
            sessions.map(async (session) => {
                const studentCount = await Enrollment.countDocuments({
                    classId: session.classId?._id,
                    status: "ACTIVE",
                });

                return {
                    id: session._id.toString(),
                    title: session.title,
                    className: session.classId?.name || "",
                    teacher: session.teacherId?.fullName || "",
                    startAt: session.startAt,
                    endAt: session.endAt,
                    meetUrl: session.meetUrl,
                    status: session.status,
                    studentCount,
                };
            })
        );

        const classQuery =
            req.user.role === "ADMIN" ? {} : { teacherId: req.user._id };

        const classes = await ClassRoom.find(classQuery).select("name");

        return res.json({
            sessions: rows,
            classes: classes.map((item) => ({
                id: item._id.toString(),
                name: item.name,
            })),
        });
    } catch (error) {
        console.error("Get meet error:", error);
        return res.status(500).json({
            message: "Lỗi server khi lấy danh sách phòng Meet",
        });
    }
}

export async function getClassDetail(req, res) {
    try {
        const { classId } = req.params;

        const classRoom = await ClassRoom.findById(classId)
            .populate("subjectId", "name")
            .populate("teacherId", "fullName email");

        if (!classRoom) {
            return res.status(404).json({
                message: "Không tìm thấy lớp học",
            });
        }

        if (
            req.user.role === "TEACHER" &&
            classRoom.teacherId._id.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "Bạn không có quyền xem lớp học này",
            });
        }

        const enrollments = await Enrollment.find({
            classId: classRoom._id,
            status: {
                $ne: "REMOVED",
            },
        })
            .populate("studentId", "fullName email facebookUrl status")
            .sort({ createdAt: -1 });

        const lessons = await Lesson.find({
            classId: classRoom._id,
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
                        googleDriveFileId: file.googleDriveFileId,
                        mimeType: file.mimeType,
                        size: file.size,
                    })),
                };
            })
        );

        const meetSessions = await MeetSession.find({
            classId: classRoom._id,
        })
            .populate("lessonId", "title")
            .sort({ startAt: 1 });

        return res.json({
            classRoom: {
                id: classRoom._id.toString(),
                name: classRoom.name,
                grade: classRoom.grade,
                description: classRoom.description,
                status: classRoom.status,
                subject: classRoom.subjectId?.name || "",
                teacher: classRoom.teacherId?.fullName || "",
                teacherEmail: classRoom.teacherId?.email || "",
            },
            students: enrollments.map((item) => ({
                id: item.studentId._id.toString(),
                name: item.studentId.fullName,
                email: item.studentId.email,
                facebookUrl: item.studentId.facebookUrl || "",
                accountStatus: item.studentId.status,
                classStatus: item.status,
            })),
            lessons: lessonRows,
            meetSessions: meetSessions.map((item) => ({
                id: item._id.toString(),
                title: item.title,
                description: item.description,
                lessonTitle: item.lessonId?.title || "",
                meetUrl: item.meetUrl,
                startAt: item.startAt,
                endAt: item.endAt,
                status: item.status,
            })),
        });
    } catch (error) {
        console.error("Get class detail error:", error);

        return res.status(500).json({
            message: "Lỗi server khi lấy chi tiết lớp học",
        });
    }
}

export async function createMeetInClass(req, res) {
    try {
        const { classId } = req.params;

        const { title, description, lessonId } = req.body;

        if (!title) {
            return res.status(400).json({
                message: "Vui lòng nhập tiêu đề phòng học",
            });
        }

        const classRoom = await ClassRoom.findById(classId).populate(
            "teacherId",
            "fullName email"
        );

        if (!classRoom) {
            return res.status(404).json({
                message: "Không tìm thấy lớp học",
            });
        }

        if (
            req.user.role === "TEACHER" &&
            classRoom.teacherId._id.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "Bạn không có quyền tạo Meet cho lớp này",
            });
        }

        const enrollments = await Enrollment.find({
            classId: classRoom._id,
            status: "ACTIVE",
        }).populate("studentId", "email fullName");

        const attendeeEmails = enrollments
            .map((enrollment) => enrollment.studentId?.email)
            .filter(Boolean);

        const now = new Date();
        const defaultEndAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const calendarEvent = await createGoogleMeetEvent({
            title,
            description,
            startAt: now,
            endAt: defaultEndAt,
            attendees: attendeeEmails,
        });

        if (!calendarEvent.meetUrl) {
            return res.status(500).json({
                message: "Google Calendar đã tạo event nhưng chưa trả về link Meet",
            });
        }

        const meetSession = await MeetSession.create({
            classId: classRoom._id,
            lessonId: lessonId || null,
            teacherId: classRoom.teacherId._id,
            createdBy: req.user._id,
            title,
            description,
            meetUrl: calendarEvent.meetUrl,
            googleEventId: calendarEvent.googleEventId,
            startAt: new Date(calendarEvent.startAt || now),
            endAt: calendarEvent.endAt
                ? new Date(calendarEvent.endAt)
                : defaultEndAt,
            status: "SCHEDULED",
            emailSentAt: new Date(),
        });

        await Notification.create(
            enrollments.map((enrollment) => ({
                userId: enrollment.studentId._id,
                meetSessionId: meetSession._id,
                type: "EMAIL",
                status: "SENT",
                title: `Lịch học mới: ${title}`,
                message: `Bạn có buổi học mới. Link Meet: ${meetSession.meetUrl}`,
                sentAt: new Date(),
            }))
        );

        return res.status(201).json({
            message: "Tạo phòng Google Meet cho lớp thành công",
            meetSession: {
                id: meetSession._id.toString(),
                title: meetSession.title,
                meetUrl: meetSession.meetUrl,
                googleEventId: meetSession.googleEventId,
                startAt: meetSession.startAt,
                endAt: meetSession.endAt,
                studentCount: attendeeEmails.length,
            },
        });
    } catch (error) {
        console.error("Create meet in class error:", {
            message: error.message,
            response: error.response?.data,
        });

        return res.status(500).json({
            message:
                error.response?.data?.error?.message ||
                error.message ||
                "Lỗi server khi tạo phòng Google Meet",
        });
    }
}

export async function searchStudentsForClass(req, res) {
    try {
        const { classId } = req.params;
        const { q = "" } = req.query;

        const { classRoom, error } = await checkClassPermission(classId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const keyword = q.trim();

        const query = {
            role: "STUDENT",
        };

        if (keyword) {
            query.$or = [
                {
                    fullName: {
                        $regex: keyword,
                        $options: "i",
                    },
                },
                {
                    email: {
                        $regex: keyword,
                        $options: "i",
                    },
                },
            ];
        }

        const students = await User.find(query)
            .select("fullName email facebookUrl status")
            .sort({ createdAt: -1 })
            .limit(20);

        const studentIds = students.map((student) => student._id);

        const enrollments = await Enrollment.find({
            classId: classRoom._id,
            studentId: {
                $in: studentIds,
            },
            status: {
                $ne: "REMOVED",
            },
        });

        const enrollmentMap = new Map();

        enrollments.forEach((item) => {
            enrollmentMap.set(item.studentId.toString(), item);
        });

        return res.json({
            students: students.map((student) => {
                const enrollment = enrollmentMap.get(student._id.toString());

                return {
                    id: student._id.toString(),
                    name: student.fullName,
                    email: student.email,
                    facebookUrl: student.facebookUrl || "",
                    accountStatus: student.status,
                    inClass: Boolean(enrollment),
                    classStatus: enrollment?.status || null,
                };
            }),
        });
    } catch (error) {
        console.error("Search students for class error:", error);

        return res.status(500).json({
            message: "Lỗi server khi tìm học sinh",
        });
    }
}

export async function addStudentToClass(req, res) {
    try {
        const { classId } = req.params;
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({
                message: "Thiếu học sinh cần thêm",
            });
        }

        const { classRoom, error } = await checkClassPermission(classId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const student = await User.findById(studentId);

        if (!student || student.role !== "STUDENT") {
            return res.status(400).json({
                message: "Học sinh không hợp lệ",
            });
        }

        const existingEnrollment = await Enrollment.findOne({
            classId: classRoom._id,
            studentId: student._id,
        });

        if (existingEnrollment) {
            if (existingEnrollment.status === "ACTIVE") {
                return res.status(400).json({
                    message: "Học sinh đã có trong lớp",
                });
            }

            existingEnrollment.status = "ACTIVE";
            await existingEnrollment.save();

            return res.json({
                message: "Đã bật lại học sinh trong lớp",
                enrollment: existingEnrollment,
            });
        }

        const enrollment = await Enrollment.create({
            classId: classRoom._id,
            studentId: student._id,
            status: "ACTIVE",
        });

        return res.status(201).json({
            message: "Thêm học sinh vào lớp thành công",
            enrollment,
        });
    } catch (error) {
        console.error("Add student to class error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                message: "Học sinh đã tồn tại trong lớp",
            });
        }

        return res.status(500).json({
            message: "Lỗi server khi thêm học sinh vào lớp",
        });
    }
}

export async function updateStudentClassStatus(req, res) {
    try {
        const { classId, studentId } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                message: "Trạng thái không hợp lệ",
            });
        }

        const { classRoom, error } = await checkClassPermission(classId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const enrollment = await Enrollment.findOne({
            classId: classRoom._id,
            studentId,
            status: {
                $ne: "REMOVED",
            },
        });

        if (!enrollment) {
            return res.status(404).json({
                message: "Học sinh không có trong lớp",
            });
        }

        enrollment.status = status;
        await enrollment.save();

        return res.json({
            message:
                status === "ACTIVE"
                    ? "Đã bật hoạt động cho học sinh"
                    : "Đã tạm tắt học sinh trong lớp",
            enrollment,
        });
    } catch (error) {
        console.error("Update student class status error:", error);

        return res.status(500).json({
            message: "Lỗi server khi cập nhật trạng thái học sinh",
        });
    }
}

export async function removeStudentFromClass(req, res) {
    try {
        const { classId, studentId } = req.params;

        const { classRoom, error } = await checkClassPermission(classId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const enrollment = await Enrollment.findOne({
            classId: classRoom._id,
            studentId,
            status: {
                $ne: "REMOVED",
            },
        });

        if (!enrollment) {
            return res.status(404).json({
                message: "Học sinh không có trong lớp",
            });
        }

        enrollment.status = "REMOVED";
        await enrollment.save();

        return res.json({
            message: "Đã xóa học sinh khỏi lớp",
        });
    } catch (error) {
        console.error("Remove student from class error:", error);

        return res.status(500).json({
            message: "Lỗi server khi xóa học sinh khỏi lớp",
        });
    }
}

export async function getTeachersPage(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        const { q = "", status = "" } = req.query;

        const query = {
            role: "TEACHER",
            ...buildSearchQuery(q, ["fullName", "email"]),
        };

        if (status) {
            query.status = status;
        }

        const teachers = await User.find(query)
            .populate("subjectId", "name")
            .select("fullName email phone facebookUrl avatarUrl status subjectId createdAt")
            .sort({ createdAt: -1 });

        const rows = await Promise.all(
            teachers.map(async (teacher) => {
                const classCount = await ClassRoom.countDocuments({
                    teacherId: teacher._id,
                });

                return {
                    id: teacher._id.toString(),
                    name: teacher.fullName,
                    email: teacher.email,
                    phone: teacher.phone || "",
                    facebookUrl: teacher.facebookUrl || "",
                    status: teacher.status,
                    subjectId: teacher.subjectId?._id?.toString() || "",
                    subjectName: teacher.subjectId?.name || "Chưa phân môn",
                    classCount,
                    createdAt: teacher.createdAt,
                };
            })
        );

        const subjects = await Subject.find({
            status: "ACTIVE",
        }).sort({ name: 1 });

        return res.json({
            teachers: rows,
            subjects: subjects.map((subject) => ({
                id: subject._id.toString(),
                name: subject.name,
            })),
        });
    } catch (error) {
        console.error("Get teachers error:", error);

        return res.status(500).json({
            message: "Lỗi server khi lấy danh sách giáo viên",
        });
    }
}

export async function createTeacher(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        const { fullName, email, password, phone, facebookUrl, subjectId } =
            req.body;

        if (!fullName || !email || !password || !subjectId) {
            return res.status(400).json({
                message: "Vui lòng nhập đầy đủ tên, email, mật khẩu và môn học",
            });
        }

        const subject = await Subject.findById(subjectId);

        if (!subject) {
            return res.status(400).json({
                message: "Môn học không hợp lệ",
            });
        }

        const existedUser = await User.findOne({
            email: email.toLowerCase().trim(),
        });

        if (existedUser) {
            return res.status(400).json({
                message: "Email này đã tồn tại",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const teacher = await User.create({
            fullName,
            email,
            passwordHash,
            role: "TEACHER",
            phone,
            facebookUrl,
            subjectId,
            status: "ACTIVE",
        });

        return res.status(201).json({
            message: "Tạo giáo viên thành công",
            teacher: {
                id: teacher._id.toString(),
                name: teacher.fullName,
                email: teacher.email,
            },
        });
    } catch (error) {
        console.error("Create teacher error:", error);

        return res.status(500).json({
            message: "Lỗi server khi tạo giáo viên",
        });
    }
}

export async function createStudent(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        const { fullName, email, password, phone, facebookUrl } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập tên, email và mật khẩu",
            });
        }

        const existedUser = await User.findOne({
            email: email.toLowerCase().trim(),
        });

        if (existedUser) {
            return res.status(400).json({
                message: "Email này đã tồn tại",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const student = await User.create({
            fullName,
            email,
            passwordHash,
            role: "STUDENT",
            phone,
            facebookUrl,
            status: "ACTIVE",
        });

        return res.status(201).json({
            message: "Tạo học sinh thành công",
            student: {
                id: student._id.toString(),
                name: student.fullName,
                email: student.email,
            },
        });
    } catch (error) {
        console.error("Create student error:", error);

        return res.status(500).json({
            message: "Lỗi server khi tạo học sinh",
        });
    }
}

export async function updateUserAccountStatus(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        const { userId } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                message: "Trạng thái không hợp lệ",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy tài khoản",
            });
        }

        if (!["TEACHER", "STUDENT"].includes(user.role)) {
            return res.status(400).json({
                message: "Không thể thay đổi trạng thái tài khoản này",
            });
        }

        user.status = status;
        await user.save();

        return res.json({
            message:
                status === "ACTIVE"
                    ? "Đã mở lại hoạt động tài khoản"
                    : "Đã tạm đóng hoạt động tài khoản",
            user: {
                id: user._id.toString(),
                status: user.status,
            },
        });
    } catch (error) {
        console.error("Update user status error:", error);

        return res.status(500).json({
            message: "Lỗi server khi cập nhật trạng thái tài khoản",
        });
    }
}

export async function updateTeacher(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const { teacherId } = req.params;
    const {
      fullName,
      email,
      password,
      phone,
      facebookUrl,
      subjectId,
      status,
    } = req.body;

    const teacher = await User.findById(teacherId);

    if (!teacher || teacher.role !== "TEACHER") {
      return res.status(404).json({
        message: "Không tìm thấy giáo viên",
      });
    }

    if (email && email.toLowerCase().trim() !== teacher.email) {
      const existed = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: teacher._id },
      });

      if (existed) {
        return res.status(400).json({
          message: "Email này đã được sử dụng",
        });
      }

      teacher.email = email.toLowerCase().trim();
    }

    if (subjectId) {
      const subject = await Subject.findById(subjectId);

      if (!subject) {
        return res.status(400).json({
          message: "Môn học không hợp lệ",
        });
      }

      teacher.subjectId = subjectId;

      // Đồng bộ lại môn của toàn bộ lớp mà giáo viên này đang dạy.
      await ClassRoom.updateMany(
        { teacherId: teacher._id },
        { subjectId }
      );
    }

    if (fullName !== undefined) teacher.fullName = fullName;
    if (phone !== undefined) teacher.phone = phone;
    if (facebookUrl !== undefined) teacher.facebookUrl = facebookUrl;

    if (status && ["ACTIVE", "INACTIVE"].includes(status)) {
      teacher.status = status;
    }

    if (password) {
      teacher.passwordHash = await bcrypt.hash(password, 10);
    }

    await teacher.save();

    return res.json({
      message: "Cập nhật giáo viên thành công",
    });
  } catch (error) {
    console.error("Update teacher error:", error);

    return res.status(500).json({
      message: "Lỗi server khi cập nhật giáo viên",
    });
  }
}

export async function updateStudent(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const { studentId } = req.params;
    const { fullName, email, password, phone, facebookUrl, status } = req.body;

    const student = await User.findById(studentId);

    if (!student || student.role !== "STUDENT") {
      return res.status(404).json({
        message: "Không tìm thấy học sinh",
      });
    }

    if (email && email.toLowerCase().trim() !== student.email) {
      const existed = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: student._id },
      });

      if (existed) {
        return res.status(400).json({
          message: "Email này đã được sử dụng",
        });
      }

      student.email = email.toLowerCase().trim();
    }

    if (fullName !== undefined) student.fullName = fullName;
    if (phone !== undefined) student.phone = phone;
    if (facebookUrl !== undefined) student.facebookUrl = facebookUrl;

    if (status && ["ACTIVE", "INACTIVE"].includes(status)) {
      student.status = status;
    }

    if (password) {
      student.passwordHash = await bcrypt.hash(password, 10);
    }

    await student.save();

    return res.json({
      message: "Cập nhật học sinh thành công",
    });
  } catch (error) {
    console.error("Update student error:", error);

    return res.status(500).json({
      message: "Lỗi server khi cập nhật học sinh",
    });
  }
}

export async function updateClassRoom(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const { classId } = req.params;
    const { name, grade, description, teacherId, status } = req.body;

    const classRoom = await ClassRoom.findById(classId);

    if (!classRoom) {
      return res.status(404).json({
        message: "Không tìm thấy lớp học",
      });
    }

    if (teacherId) {
      const teacher = await User.findById(teacherId);

      if (!teacher || teacher.role !== "TEACHER") {
        return res.status(400).json({
          message: "Giáo viên không hợp lệ",
        });
      }

      if (!teacher.subjectId) {
        return res.status(400).json({
          message: "Giáo viên chưa được phân môn học",
        });
      }

      classRoom.teacherId = teacher._id;
      classRoom.subjectId = teacher.subjectId;
    }

    if (name !== undefined) classRoom.name = name;
    if (grade !== undefined) classRoom.grade = grade;
    if (description !== undefined) classRoom.description = description;

    if (status && ["ACTIVE", "UPCOMING", "ARCHIVED"].includes(status)) {
      classRoom.status = status;
    }

    await classRoom.save();

    return res.json({
      message: "Cập nhật lớp học thành công",
    });
  } catch (error) {
    console.error("Update class error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Giáo viên đã có lớp trùng tên này",
      });
    }

    return res.status(500).json({
      message: "Lỗi server khi cập nhật lớp học",
    });
  }
}