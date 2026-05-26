export type LockScreenAssetDto = {
  id: string;
  tenantId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssetListOutput = {
  items: LockScreenAssetDto[];
};

export const mapLockScreenAssetDto = (asset: {
  id: string;
  tenantId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LockScreenAssetDto => ({
  id: asset.id,
  tenantId: asset.tenantId,
  fileName: asset.fileName,
  filePath: asset.filePath,
  fileSize: asset.fileSize,
  mimeType: asset.mimeType,
  isActive: asset.isActive,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString(),
});
