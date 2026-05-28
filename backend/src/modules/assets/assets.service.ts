import fs from "fs/promises";
import path from "path";

import { AppError } from "../../shared/errors/app-error";
import { prisma } from "../../shared/prisma/prisma.client";
import { mapLockScreenAssetDto, type AssetListOutput, type LockScreenAssetDto } from "./assets.types";

export class AssetsService {
  private readonly prismaClient: typeof prisma;

  constructor(dependencies: { prismaClient?: typeof prisma } = {}) {
    this.prismaClient = dependencies.prismaClient ?? prisma;
  }

  public async uploadAsset(
    tenantId: string | null | undefined,
    file: Express.Multer.File | undefined,
  ): Promise<LockScreenAssetDto> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to access this tenant.");
    }
    if (!file) {
      throw new AppError(400, "BAD_REQUEST", "No image file provided.");
    }

    // Đường dẫn tương đối dùng để lưu trong DB và serve static sau này
    // Ví dụ: uploads/lockscreen/filename.png
    const relativePath = `uploads/lockscreen/${file.filename}`;

    const asset = await this.prismaClient.lockScreenAsset.create({
      data: {
        tenantId,
        fileName: file.originalname,
        filePath: relativePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        isActive: true,
      },
    });

    return mapLockScreenAssetDto(asset);
  }

  public async listAssets(
    tenantId: string | null | undefined,
    onlyActive = false,
  ): Promise<AssetListOutput> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to access this tenant.");
    }

    const where: any = {
      tenantId,
    };
    if (onlyActive) {
      where.isActive = true;
    }

    const items = await this.prismaClient.lockScreenAsset.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      items: items.map(mapLockScreenAssetDto),
    };
  }

  public async toggleActive(
    tenantId: string | null | undefined,
    assetId: string,
    isActive: boolean,
  ): Promise<LockScreenAssetDto> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to access this tenant.");
    }

    const asset = await this.prismaClient.lockScreenAsset.findFirst({
      where: {
        id: assetId,
        tenantId,
      },
    });

    if (!asset) {
      throw new AppError(404, "NOT_FOUND", "Asset not found.");
    }

    const updatedAsset = await this.prismaClient.lockScreenAsset.update({
      where: {
        id: assetId,
      },
      data: {
        isActive,
      },
    });

    return mapLockScreenAssetDto(updatedAsset);
  }

  public async deleteAsset(tenantId: string | null | undefined, assetId: string): Promise<void> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to access this tenant.");
    }

    const asset = await this.prismaClient.lockScreenAsset.findFirst({
      where: {
        id: assetId,
        tenantId,
      },
    });

    if (!asset) {
      throw new AppError(404, "NOT_FOUND", "Asset not found.");
    }

    // Xóa từ Database
    await this.prismaClient.lockScreenAsset.delete({
      where: {
        id: assetId,
      },
    });

    // Xóa file vật lý trên đĩa cứng
    // Tên file gốc lưu ở backend/public/uploads/lockscreen/filename
    const fileName = path.basename(asset.filePath);
    const absolutePath = path.join(process.cwd(), "public/uploads/lockscreen", fileName);

    try {
      await fs.unlink(absolutePath);
    } catch (error: any) {
      // Bỏ qua lỗi nếu file không tồn tại trên ổ cứng để tránh làm kẹt luồng xóa DB
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export const assetsService = new AssetsService();
