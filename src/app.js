import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import adminDataRoutes from "./routes/adminDataRoutes.js";
import googleAuthRoutes from "./routes/googleAuthRoutes.js";
import studentDataRoutes from "./routes/studentDataRoutes.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "EduMeet LMS API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin-data", adminDataRoutes);
app.use("/api/student-data", studentDataRoutes);
app.use("/api/google", googleAuthRoutes);

export default app;