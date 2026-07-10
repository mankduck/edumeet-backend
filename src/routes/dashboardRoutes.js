import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { allowRoles, protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", protect, allowRoles("ADMIN", "TEACHER"), getDashboard);

export default router;