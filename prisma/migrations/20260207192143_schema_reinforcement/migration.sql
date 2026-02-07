/*
  Warnings:

  - The required column `groupKey` was added to the `CompanyFieldFile` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `groupKey` was added to the `ContactFieldFile` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `groupKey` was added to the `DealFieldFile` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `groupKey` was added to the `LeadFieldFile` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE `companyfieldfile` ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `replacedAt` DATETIME(3) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `contactfieldfile` ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `replacedAt` DATETIME(3) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `customfield` ADD COLUMN `workspaceId` INTEGER NULL;

-- AlterTable
ALTER TABLE `dealfieldfile` ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `replacedAt` DATETIME(3) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `leadfieldfile` ADD COLUMN `groupKey` VARCHAR(191) NULL,
    ADD COLUMN `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `replacedAt` DATETIME(3) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `pipeline` ADD COLUMN `workspaceId` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `teamId` INTEGER NULL,
    ADD COLUMN `workspaceId` INTEGER NULL;

-- Backfill groupKey for existing rows
UPDATE `companyfieldfile` SET `groupKey` = UUID() WHERE `groupKey` IS NULL;
UPDATE `contactfieldfile` SET `groupKey` = UUID() WHERE `groupKey` IS NULL;
UPDATE `dealfieldfile` SET `groupKey` = UUID() WHERE `groupKey` IS NULL;
UPDATE `leadfieldfile` SET `groupKey` = UUID() WHERE `groupKey` IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE `companyfieldfile` MODIFY `groupKey` VARCHAR(191) NOT NULL;
ALTER TABLE `contactfieldfile` MODIFY `groupKey` VARCHAR(191) NOT NULL;
ALTER TABLE `dealfieldfile` MODIFY `groupKey` VARCHAR(191) NOT NULL;
ALTER TABLE `leadfieldfile` MODIFY `groupKey` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `workspaceId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Team_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NOT NULL,
    `entityType` ENUM('DEAL', 'LEAD', 'CONTACT', 'COMPANY', 'PIPELINE', 'STAGE', 'CUSTOM_FIELD', 'FILE', 'USER', 'TEAM', 'WORKSPACE') NOT NULL,
    `entityId` INTEGER NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'STAGE_MOVE', 'FILE_UPLOAD', 'FILE_DELETE', 'FILE_REPLACE') NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CompanyFieldFile_groupKey_idx` ON `CompanyFieldFile`(`groupKey`);

-- CreateIndex
CREATE INDEX `CompanyFieldFile_isCurrent_idx` ON `CompanyFieldFile`(`isCurrent`);

-- CreateIndex
CREATE INDEX `ContactFieldFile_groupKey_idx` ON `ContactFieldFile`(`groupKey`);

-- CreateIndex
CREATE INDEX `ContactFieldFile_isCurrent_idx` ON `ContactFieldFile`(`isCurrent`);

-- CreateIndex
CREATE INDEX `CustomField_workspaceId_idx` ON `CustomField`(`workspaceId`);

-- CreateIndex
CREATE INDEX `DealFieldFile_groupKey_idx` ON `DealFieldFile`(`groupKey`);

-- CreateIndex
CREATE INDEX `DealFieldFile_isCurrent_idx` ON `DealFieldFile`(`isCurrent`);

-- CreateIndex
CREATE INDEX `LeadFieldFile_groupKey_idx` ON `LeadFieldFile`(`groupKey`);

-- CreateIndex
CREATE INDEX `LeadFieldFile_isCurrent_idx` ON `LeadFieldFile`(`isCurrent`);

-- CreateIndex
CREATE INDEX `Pipeline_workspaceId_idx` ON `Pipeline`(`workspaceId`);

-- CreateIndex
CREATE INDEX `User_workspaceId_idx` ON `User`(`workspaceId`);

-- CreateIndex
CREATE INDEX `User_teamId_idx` ON `User`(`teamId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pipeline` ADD CONSTRAINT `Pipeline_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomField` ADD CONSTRAINT `CustomField_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
