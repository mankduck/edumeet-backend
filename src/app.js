import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import adminDataRoutes from "./routes/adminDataRoutes.js";
import googleAuthRoutes from "./routes/googleAuthRoutes.js";
import studentDataRoutes from "./routes/studentDataRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://edumeet-vn.netlify.app",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "https://edumeet-vn.netlify.app",
//     ],
//     credentials: true,
//     methods: ["GET", "POST"],
//   })
// );

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
app.use("/api",fileRoutes);

export default app;