import fs from "fs-extra";
import ClassRoom from "../models/ClassRoom.js";
import Lesson from "../models/Lesson.js";
import LessonFile from "../models/LessonFile.js";
import {
    deleteFileFromDrive,
    uploadFileToDrive,
} from "../services/googleDriveService.js";

function getFileType(mimeType) {
    if (
        mimeType === "application/msword" ||
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return "WORD";
    }

    if (
        mimeType === "application/vnd.ms-excel" ||
        mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
        return "EXCEL";
    }

    if (
        mimeType === "application/vnd.ms-powerpoint" ||
        mimeType ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
        return "POWERPOINT";
    }

    if (mimeType === "application/pdf") {
        return "PDF";
    }

    return null;
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
                message: "Bạn không có quyền thao tác với lớp này",
            },
        };
    }

    return {
        classRoom,
    };
}

async function checkLessonPermission(lessonId, user) {
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
        return {
            error: {
                status: 404,
                message: "Không tìm thấy bài học",
            },
        };
    }

    const { classRoom, error } = await checkClassPermission(lesson.classId, user);

    if (error) {
        return {
            error,
        };
    }

    return {
        lesson,
        classRoom,
    };
}

export async function createLesson(req, res) {
    try {
        const { classId } = req.params;
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({
                message: "Vui lòng nhập tên bài học",
            });
        }

        const { error } = await checkClassPermission(classId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const lesson = await Lesson.create({
            classId,
            title,
            description,
            status: "PUBLISHED",
        });

        return res.status(201).json({
            message: "Tạo bài học thành công",
            lesson,
        });
    } catch (error) {
        console.error("Create lesson error:", error);

        return res.status(500).json({
            message: "Lỗi server khi tạo bài học",
        });
    }
}

export async function updateLesson(req, res) {
    try {
        const { lessonId } = req.params;
        const { title, description } = req.body;

        const { lesson, error } = await checkLessonPermission(lessonId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        if (title !== undefined) {
            lesson.title = title;
        }

        if (description !== undefined) {
            lesson.description = description;
        }

        await lesson.save();

        return res.json({
            message: "Cập nhật bài học thành công",
            lesson,
        });
    } catch (error) {
        console.error("Update lesson error:", error);

        return res.status(500).json({
            message: "Lỗi server khi cập nhật bài học",
        });
    }
}

export async function uploadLessonFilesController(req, res) {
    const uploadedTempFiles = req.files || [];

    try {
        const { lessonId } = req.params;

        const { lesson, error } = await checkLessonPermission(lessonId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const maxFiles = Number(process.env.MAX_FILES_PER_LESSON || 5);

        const currentFileCount = await LessonFile.countDocuments({
            lessonId: lesson._id,
        });

        if (currentFileCount + uploadedTempFiles.length > maxFiles) {
            return res.status(400).json({
                message: `Mỗi bài học chỉ được tối đa ${maxFiles} file`,
            });
        }

        if (uploadedTempFiles.length === 0) {
            return res.status(400).json({
                message: "Vui lòng chọn file cần upload",
            });
        }

        const createdFiles = [];

        for (const file of uploadedTempFiles) {
            const fileType = getFileType(file.mimetype);

            if (!fileType) {
                throw new Error("File không đúng định dạng Word, Excel hoặc PowerPoint");
            }

            const driveFile = await uploadFileToDrive(file);

            const lessonFile = await LessonFile.create({
                lessonId: lesson._id,
                uploadedBy: req.user._id,
                fileType,
                fileName: driveFile.fileName,
                originalName: file.originalname,
                fileUrl: driveFile.fileUrl,
                downloadUrl: driveFile.downloadUrl,
                googleDriveFileId: driveFile.googleDriveFileId,
                mimeType: file.mimetype,
                size: file.size,
            });

            createdFiles.push({
                id: lessonFile._id.toString(),
                fileName: lessonFile.fileName,
                originalName: lessonFile.originalName,
                fileType: lessonFile.fileType,
                fileUrl: lessonFile.fileUrl,
                downloadUrl: lessonFile.downloadUrl,
                size: lessonFile.size,
            });
        }

        return res.status(201).json({
            message: "Upload file bài học thành công",
            files: createdFiles,
        });
    } catch (error) {
        console.error("Upload lesson files error:", error);

        return res.status(500).json({
            message: error.message || "Lỗi server khi upload file",
        });
    } finally {
        for (const file of uploadedTempFiles) {
            await fs.remove(file.path);
        }
    }
}

export async function deleteLessonFile(req, res) {
    try {
        const { lessonId, fileId } = req.params;

        const { lesson, error } = await checkLessonPermission(lessonId, req.user);

        if (error) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        const lessonFile = await LessonFile.findOne({
            _id: fileId,
            lessonId: lesson._id,
        });

        if (!lessonFile) {
            return res.status(404).json({
                message: "Không tìm thấy file bài học",
            });
        }

        await deleteFileFromDrive(lessonFile.googleDriveFileId);
        await lessonFile.deleteOne();

        return res.json({
            message: "Xóa file bài học thành công",
        });
    } catch (error) {
        console.error("Delete lesson file error:", error);

        return res.status(500).json({
            message: "Lỗi server khi xóa file bài học",
        });
    }
}
