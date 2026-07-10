import fs from "fs";
import multer from "multer";
import path from "path";

const uploadDir = path.resolve(process.cwd(), "uploads/temp");

fs.mkdirSync(uploadDir, {
  recursive: true,
});

const allowedMimeTypes = [
  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function fileFilter(req, file, cb) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Chỉ cho phép upload file Word, Excel hoặc PowerPoint")
    );
  }

  cb(null, true);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const uploadLessonFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE_MB || 200) * 1024 * 1024,
  },
});