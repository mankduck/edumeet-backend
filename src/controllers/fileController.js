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

export async function previewDriveFile(req, res) {

    try {

        const drive = getDriveClient(); // <-- thêm dòng này

        const { fileId } = req.params;


        const fileInfo = await drive.files.get({

            fileId,

            fields: "name,mimeType"

        });


        res.setHeader(
            "Content-Type",
            fileInfo.data.mimeType
        );


        const fileStream = await drive.files.get(
            {
                fileId,
                alt: "media"
            },
            {
                responseType: "stream"
            }
        );


        fileStream.data.pipe(res);


    } catch (error) {

        console.error(
            "Preview Drive error:",
            error.response?.data || error.message
        );


        res.status(500).json({
            message: "Preview file failed"
        });

    }

}