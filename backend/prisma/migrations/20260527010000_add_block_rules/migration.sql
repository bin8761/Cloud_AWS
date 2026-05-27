-- CreateTable
CREATE TABLE `BlockRule` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` ENUM('URL', 'PROCESS', 'KEYWORD') NOT NULL,
    `value` VARCHAR(500) NOT NULL,
    `label` VARCHAR(200) NULL,
    `reason` VARCHAR(500) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlockRule_tenantId_type_value_key`(`tenantId`, `type`, `value`),
    INDEX `BlockRule_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `BlockRule_tenantId_type_status_idx`(`tenantId`, `type`, `status`),
    INDEX `BlockRule_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BlockRule` ADD CONSTRAINT `BlockRule_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
