import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.development"),
});

import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import ClassRoom from "../models/ClassRoom.js";
import Enrollment from "../models/Enrollment.js";
import Lesson from "../models/Lesson.js";
import LessonFile from "../models/LessonFile.js";
import MeetSession from "../models/MeetSession.js";
import Notification from "../models/Notification.js";

async function seedDevData() {
  try {
    await connectDB();

    console.log("Đang xóa database dev cũ...");
    await mongoose.connection.dropDatabase();

    const passwordHash = await bcrypt.hash("123456", 10);

    console.log("Đang tạo môn gốc...");

    const mathSubject = await Subject.create({
      name: "Toán",
      description: "Môn Toán học phổ thông.",
    });

    const physicsSubject = await Subject.create({
      name: "Vật lý",
      description: "Môn Vật lý phổ thông.",
    });

    const englishSubject = await Subject.create({
      name: "Tiếng Anh",
      description: "Môn Tiếng Anh phổ thông.",
    });

    console.log("Đang tạo tài khoản mẫu...");

    await User.create({
      fullName: "Admin",
      email: "admin@gmail.com",
      passwordHash,
      role: "ADMIN",
    });

    const teacherMath = await User.create({
      fullName: "Nguyễn Văn Nam",
      email: "teacher@gmail.com",
      passwordHash,
      role: "TEACHER",
      subjectId: mathSubject._id,
      phone: "0987654321",
    });

    const teacherPhysics = await User.create({
      fullName: "Trần Minh Anh",
      email: "physics.teacher@gmail.com",
      passwordHash,
      role: "TEACHER",
      subjectId: physicsSubject._id,
    });

    const studentOne = await User.create({
      fullName: "Phạm Minh Quân",
      email: "student@gmail.com",
      passwordHash,
      role: "STUDENT",
      facebookUrl: "fb.com/minhquan",
    });

    const studentTwo = await User.create({
      fullName: "Nguyễn Hà Linh",
      email: "halinh.student@gmail.com",
      passwordHash,
      role: "STUDENT",
      facebookUrl: "fb.com/halinh",
    });

    const studentThree = await User.create({
      fullName: "Trần Gia Bảo",
      email: "giabao.student@gmail.com",
      passwordHash,
      role: "STUDENT",
      facebookUrl: "fb.com/giabao",
    });

    console.log("Đang tạo lớp học...");

    const math12 = await ClassRoom.create({
      name: "Toán 12",
      grade: "12",
      subjectId: mathSubject._id,
      teacherId: teacherMath._id,
      description:
        "Ôn tập kiến thức trọng tâm, luyện đề và chữa bài theo chuyên đề.",
      status: "ACTIVE",
    });

    const physics11 = await ClassRoom.create({
      name: "Vật lý 11",
      grade: "11",
      subjectId: physicsSubject._id,
      teacherId: teacherPhysics._id,
      description:
        "Lý thuyết, bài tập vận dụng và các buổi học online định kỳ.",
      status: "ACTIVE",
    });

    const physics12 = await ClassRoom.create({
      name: "Vật lý 12",
      grade: "12",
      subjectId: physicsSubject._id,
      teacherId: teacherPhysics._id,
      description: "Ôn thi THPT Quốc gia môn Vật lý lớp 12.",
      status: "ACTIVE",
    });

    const english10 = await ClassRoom.create({
      name: "Tiếng Anh 10",
      grade: "10",
      subjectId: englishSubject._id,
      teacherId: teacherMath._id,
      description: "Lớp demo để test giao diện.",
      status: "UPCOMING",
    });

    console.log("Đang thêm học sinh vào lớp...");

    await Enrollment.create([
      {
        classId: math12._id,
        studentId: studentOne._id,
      },
      {
        classId: math12._id,
        studentId: studentTwo._id,
      },
      {
        classId: physics11._id,
        studentId: studentOne._id,
      },
      {
        classId: physics11._id,
        studentId: studentTwo._id,
      },
      {
        classId: physics12._id,
        studentId: studentOne._id,
      },
      {
        classId: physics12._id,
        studentId: studentThree._id,
      },
    ]);

    console.log("Đang tạo bài học...");

    const lessonOne = await Lesson.create({
      classId: math12._id,
      title: "Bài 1: Hàm số và đồ thị",
      description: "Ôn tập kiến thức cơ bản về hàm số và đồ thị.",
      orderIndex: 1,
      status: "PUBLISHED",
    });

    const lessonTwo = await Lesson.create({
      classId: math12._id,
      title: "Bài 2: Cực trị hàm số",
      description: "Dạng bài tìm cực trị và ứng dụng.",
      orderIndex: 2,
      status: "PUBLISHED",
    });

    const lessonThree = await Lesson.create({
      classId: physics11._id,
      title: "Bài 4: Dao động cơ",
      description: "Lý thuyết và bài tập dao động cơ.",
      orderIndex: 1,
      status: "PUBLISHED",
    });

    const lessonFour = await Lesson.create({
      classId: physics12._id,
      title: "Bài 1: Dao động điều hòa",
      description: "Kiến thức nền tảng Vật lý 12.",
      orderIndex: 1,
      status: "PUBLISHED",
    });

    console.log("Đang tạo file bài học mẫu...");

    await LessonFile.create([
      {
        lessonId: lessonOne._id,
        uploadedBy: teacherMath._id,
        fileType: "THEORY",
        fileName: "Lý thuyết hàm số.pdf",
        fileUrl: "https://example.com/ly-thuyet-ham-so.pdf",
        mimeType: "application/pdf",
        size: 1200000,
      },
      {
        lessonId: lessonOne._id,
        uploadedBy: teacherMath._id,
        fileType: "EXERCISE",
        fileName: "Bài tập hàm số cơ bản.pdf",
        fileUrl: "https://example.com/bai-tap-ham-so.pdf",
        mimeType: "application/pdf",
        size: 850000,
      },
      {
        lessonId: lessonThree._id,
        uploadedBy: teacherPhysics._id,
        fileType: "THEORY",
        fileName: "Dao động cơ - lý thuyết.pdf",
        fileUrl: "https://example.com/dao-dong-co.pdf",
        mimeType: "application/pdf",
        size: 1500000,
      },
      {
        lessonId: lessonFour._id,
        uploadedBy: teacherPhysics._id,
        fileType: "THEORY",
        fileName: "Dao động điều hòa.pdf",
        fileUrl: "https://example.com/dao-dong-dieu-hoa.pdf",
        mimeType: "application/pdf",
        size: 1300000,
      },
    ]);

    console.log("Đang tạo lịch Meet mẫu...");

    const meetOne = await MeetSession.create({
      classId: math12._id,
      lessonId: lessonOne._id,
      teacherId: teacherMath._id,
      createdBy: teacherMath._id,
      title: "Ôn tập hàm số - Toán 12",
      meetUrl: "https://meet.google.com/abc-defg-hij",
      googleEventId: "demo-google-event-1",
      startAt: new Date(Date.now() + 1000 * 60 * 60 * 3),
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 4),
      status: "SCHEDULED",
    });

    const meetTwo = await MeetSession.create({
      classId: physics11._id,
      lessonId: lessonThree._id,
      teacherId: teacherPhysics._id,
      createdBy: teacherPhysics._id,
      title: "Bài 4: Dao động cơ - Vật lý 11",
      meetUrl: "https://meet.google.com/xyz-abcd-efg",
      googleEventId: "demo-google-event-2",
      startAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 25),
      status: "SCHEDULED",
    });

    const meetThree = await MeetSession.create({
      classId: physics12._id,
      lessonId: lessonFour._id,
      teacherId: teacherPhysics._id,
      createdBy: teacherPhysics._id,
      title: "Ôn tập Dao động điều hòa - Vật lý 12",
      meetUrl: "https://meet.google.com/qwe-rtyu-iop",
      googleEventId: "demo-google-event-3",
      startAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 49),
      status: "SCHEDULED",
    });

    console.log("Đang tạo thông báo mẫu...");

    await Notification.create([
      {
        userId: studentOne._id,
        meetSessionId: meetOne._id,
        type: "EMAIL",
        status: "SENT",
        title: "Lịch học Toán 12",
        message: `Bạn có buổi học: ${meetOne.title}. Link: ${meetOne.meetUrl}`,
        sentAt: new Date(),
      },
      {
        userId: studentOne._id,
        meetSessionId: meetTwo._id,
        type: "EMAIL",
        status: "SENT",
        title: "Lịch học Vật lý 11",
        message: `Bạn có buổi học: ${meetTwo.title}. Link: ${meetTwo.meetUrl}`,
        sentAt: new Date(),
      },
      {
        userId: studentOne._id,
        meetSessionId: meetThree._id,
        type: "EMAIL",
        status: "SENT",
        title: "Lịch học Vật lý 12",
        message: `Bạn có buổi học: ${meetThree.title}. Link: ${meetThree.meetUrl}`,
        sentAt: new Date(),
      },
    ]);

    console.log("Seed dev data thành công!");
    console.log("Admin: admin@gmail.com / 123456");
    console.log("Teacher Toán: teacher@gmail.com / 123456");
    console.log("Teacher Vật lý: physics.teacher@gmail.com / 123456");
    console.log("Student: student@gmail.com / 123456");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Seed dev data thất bại:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedDevData();