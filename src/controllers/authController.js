import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import { generateToken } from "../utils/generateToken.js";

function normalizeUserRole(role) {
    return role.toLowerCase();
}

async function buildUserResponse(user) {
    const populatedUser = await User.findById(user._id).populate(
        "subjectId",
        "name"
    );

    const safeUser = {
        id: populatedUser._id.toString(),
        name: populatedUser.fullName,
        email: populatedUser.email,
        role: populatedUser.role.toLowerCase(),
        phone: populatedUser.phone || "",
        facebookUrl: populatedUser.facebookUrl || "",
        avatarUrl: populatedUser.avatarUrl || "",
        status: populatedUser.status,
    };

    if (populatedUser.role === "TEACHER") {
        safeUser.subjectId = populatedUser.subjectId?._id?.toString() || null;
        safeUser.subjectName = populatedUser.subjectId?.name || "";
    }

    if (populatedUser.role === "STUDENT") {
        safeUser.studentId = populatedUser._id.toString();
    }

    return safeUser;
}
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập email và mật khẩu",
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
        });

        if (!user) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không đúng",
            });
        }

        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                message: "Tài khoản đang bị khóa hoặc chưa được kích hoạt",
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không đúng",
            });
        }

        const accessToken = generateToken(user);
        const safeUser = await buildUserResponse(user);

        return res.json({
            message: "Đăng nhập thành công",
            accessToken,
            user: safeUser,
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Lỗi server khi đăng nhập",
        });
    }
}

export async function getMe(req, res) {
    try {
        const safeUser = await buildUserResponse(req.user);

        return res.json({
            user: safeUser,
        });
    } catch (error) {
        console.error("Get me error:", error);

        return res.status(500).json({
            message: "Lỗi server khi lấy thông tin tài khoản",
        });
    }
}