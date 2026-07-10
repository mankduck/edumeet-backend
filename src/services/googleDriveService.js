import fs from "fs";
import { google } from "googleapis";

function getDriveClient() {
    const {
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
        GOOGLE_REFRESH_TOKEN,
    } = process.env;

    if (!GOOGLE_CLIENT_ID) {
        throw new Error("GOOGLE_CLIENT_ID chưa được khai báo");
    }

    if (!GOOGLE_CLIENT_SECRET) {
        throw new Error("GOOGLE_CLIENT_SECRET chưa được khai báo");
    }

    if (!GOOGLE_REDIRECT_URI) {
        throw new Error("GOOGLE_REDIRECT_URI chưa được khai báo");
    }

    if (!GOOGLE_REFRESH_TOKEN) {
        throw new Error("GOOGLE_REFRESH_TOKEN chưa được khai báo");
    }

    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
        refresh_token: GOOGLE_REFRESH_TOKEN,
    });

    return google.drive({
        version: "v3",
        auth: oauth2Client,
    });
}

export async function uploadFileToDrive(file) {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        throw new Error("GOOGLE_DRIVE_FOLDER_ID chưa được khai báo");
    }

    const drive = getDriveClient();

    const response = await drive.files.create({
        requestBody: {
            name: file.originalname,
            parents: [folderId],
        },
        media: {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.path),
        },
        fields: "id, name, webViewLink, webContentLink",
    });

    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
            role: "reader",
            type: "anyone",
        },
    });

    return {
        googleDriveFileId: response.data.id,
        fileUrl: response.data.webViewLink,
        downloadUrl:
            response.data.webContentLink ||
            `https://drive.google.com/uc?export=download&id=${response.data.id}`,
        fileName: response.data.name,
    };
}

export async function deleteFileFromDrive(googleDriveFileId) {
    if (!googleDriveFileId) return;

    const drive = getDriveClient();

    try {
        await drive.files.delete({
            fileId: googleDriveFileId,
        });
    } catch (error) {
        console.error("Delete Google Drive file failed:", error.message);
    }
}