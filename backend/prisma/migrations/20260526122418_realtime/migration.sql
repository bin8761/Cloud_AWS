-- AlterTable
ALTER TABLE `tenant` ADD COLUMN `computerRegistrationSecretHash` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Computer` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `macAddress` VARCHAR(191) NOT NULL,
    `deviceTokenHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `lastSeenAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Computer_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `Computer_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `Computer_tenantId_macAddress_key`(`tenantId`, `macAddress`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Computer` ADD CONSTRAINT `Computer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
