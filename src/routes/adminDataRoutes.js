import {
    addStudentToClass,
    createClass,
    createMeetInClass,
    createStudent,
    createTeacher,
    getClassDetail,
    getClassesPage,
    getLessonsPage,
    getMeetPage,
    getStudentsPage,
    getTeachersPage,
    removeStudentFromClass,
    searchStudentsForClass,
    updateClassRoom,
    updateStudent,
    updateStudentClassStatus,
    updateTeacher,
    updateUserAccountStatus,
} from "../controllers/adminDataController.js";
import {
    createLesson,
    deleteLessonFile,
    updateLesson,
    uploadLessonFilesController,
} from "../controllers/lessonController.js";

import { uploadLessonFiles } from "../middlewares/uploadMiddleware.js";
import { allowRoles, protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);
router.use(allowRoles("ADMIN", "TEACHER"));

router.get("/classes", getClassesPage);
router.post("/classes", createClass);

router.get("/classes/:classId", getClassDetail);
router.post("/classes/:classId/meet", createMeetInClass);

router.get("/classes/:classId/students/search", searchStudentsForClass);
router.post("/classes/:classId/students", addStudentToClass);
router.patch(
    "/classes/:classId/students/:studentId/status",
    updateStudentClassStatus
);
router.delete("/classes/:classId/students/:studentId", removeStudentFromClass);

router.post("/classes/:classId/lessons", createLesson);

router.patch("/lessons/:lessonId", updateLesson);

router.post(
    "/lessons/:lessonId/files",
    uploadLessonFiles.array("files", Number(process.env.MAX_FILES_PER_LESSON || 5)),
    uploadLessonFilesController
);

router.delete("/lessons/:lessonId/files/:fileId", deleteLessonFile);

router.get("/teachers", getTeachersPage);
router.post("/teachers", createTeacher);

router.get("/students", getStudentsPage);
router.post("/students", createStudent);

router.patch("/teachers/:teacherId", updateTeacher);
router.patch("/students/:studentId", updateStudent);
router.patch("/classes/:classId", updateClassRoom);

router.patch("/users/:userId/status", updateUserAccountStatus);
router.get("/lessons", getLessonsPage);
router.get("/meet", getMeetPage);

export default router;