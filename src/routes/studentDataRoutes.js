import express from "express";
import {
  getStudentClassDetail,
  getStudentClasses,
  getStudentDashboard,
  getStudentMeetSessions,
} from "../controllers/studentDataController.js";
import { allowRoles, protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(allowRoles("STUDENT"));

router.get("/dashboard", getStudentDashboard);
router.get("/classes", getStudentClasses);
router.get("/classes/:classId", getStudentClassDetail);
router.get("/meet", getStudentMeetSessions);

export default router;