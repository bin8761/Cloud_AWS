import fs from "fs";
import path from "path";
import multer from "multer";
import type { Request } from "express";

import { AppError } from "../errors/app-error";

// Đường dẫn lưu trữ file ảnh tĩnh
export const UPLOAD_DIR = path.join(process.cwd(), "public/uploads/lockscreen");

// Đảm bảo thư mục tồn tại khi import middleware
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    // Đảm bảo lại thư mục tồn tại tại runtime
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file, cb) => {
    const tenantId = req.authContext?.tenantId ?? "anonymous";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${tenantId}_${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, "BAD_REQUEST", "Only JPG and PNG images are allowed."));
  }
};

export const uploadLockscreenMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  },
});
