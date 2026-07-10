import express from "express";
import { google } from "googleapis";

const router = express.Router();

function getOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

router.get("/auth-url", (req, res) => {
    const oauth2Client = getOAuthClient();

    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/calendar.events",
        ],
    });

    res.json({ url });
});

router.get("/callback", async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send("Missing Google authorization code");
        }

        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        return res.send(`
      <h2>Google OAuth thành công</h2>
      <p>Copy refresh token này vào GOOGLE_REFRESH_TOKEN:</p>
      <pre style="white-space: pre-wrap; padding: 16px; background: #f1f5f9; border-radius: 12px;">
${tokens.refresh_token || "Không nhận được refresh_token. Hãy xóa quyền app cũ rồi thử lại."}
      </pre>
    `);
    } catch (error) {
        console.error("Google OAuth callback error:", {
            message: error.message,
            response: error.response?.data,
        });

        return res.status(500).send(`
      <h2>Google OAuth failed</h2>
      <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
    `);
    }
});

export default router;