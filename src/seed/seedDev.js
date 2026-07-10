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