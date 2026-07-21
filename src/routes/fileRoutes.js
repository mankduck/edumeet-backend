import express from "express";
import {
    previewDriveFile
} from "../controllers/fileController.js";


const router = express.Router();


router.get(
    "/files/:fileId/preview",
    previewDriveFile
);


export default router;