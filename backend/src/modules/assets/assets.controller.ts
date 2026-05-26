import type { NextFunction, Request, Response } from "express";

import { assetsService } from "./assets.service";

export class AssetsController {
  public async upload(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const data = await assetsService.uploadAsset(
        request.authContext?.tenantId,
        request.file,
      );
      response.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async list(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const onlyActive = request.query.active === "true";
      const data = await assetsService.listAssets(
        request.authContext?.tenantId,
        onlyActive,
      );
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async updateActive(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = request.params;
      const { isActive } = request.body as { isActive: boolean };
      const data = await assetsService.toggleActive(
        request.authContext?.tenantId,
        id,
        isActive,
      );
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async delete(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = request.params;
      await assetsService.deleteAsset(request.authContext?.tenantId, id);
      response.status(200).json({ success: true, message: "Asset deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

export const assetsController = new AssetsController();
