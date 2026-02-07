/*
  Warnings:

  - You are about to alter the column `expectedRevenue` on the `deal` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `companyfieldvalue` ADD COLUMN `valueBoolean` BOOLEAN NULL,
    ADD COLUMN `valueOptionId` INTEGER NULL,
    ADD COLUMN `valueUserId` INTEGER NULL;

-- AlterTable
ALTER TABLE `contactfieldvalue` ADD COLUMN `valueBoolean` BOOLEAN NULL,
    ADD COLUMN `valueOptionId` INTEGER NULL,
    ADD COLUMN `valueUserId` INTEGER NULL;

-- AlterTable
ALTER TABLE `customfield` ADD COLUMN `formula` VARCHAR(191) NULL,
    MODIFY `type` ENUM('text', 'number', 'date', 'datetime', 'single_select', 'multi_select', 'boolean', 'user', 'users', 'file', 'calculation') NOT NULL;

-- AlterTable
ALTER TABLE `deal` MODIFY `expectedRevenue` DOUBLE NULL;

-- AlterTable
ALTER TABLE `dealfieldvalue` ADD COLUMN `valueBoolean` BOOLEAN NULL,
    ADD COLUMN `valueOptionId` INTEGER NULL,
    ADD COLUMN `valueUserId` INTEGER NULL;

-- AlterTable
ALTER TABLE `leadfieldvalue` ADD COLUMN `valueBoolean` BOOLEAN NULL,
    ADD COLUMN `valueOptionId` INTEGER NULL,
    ADD COLUMN `valueUserId` INTEGER NULL;

-- CreateTable
CREATE TABLE `CustomFieldOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fieldId` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomFieldOption_fieldId_deletedAt_idx`(`fieldId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DealFieldOptionValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dealId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DealFieldOptionValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `DealFieldOptionValue_dealId_fieldId_optionId_key`(`dealId`, `fieldId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DealFieldUserValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dealId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DealFieldUserValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `DealFieldUserValue_dealId_fieldId_userId_key`(`dealId`, `fieldId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DealFieldFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dealId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DealFieldFile_fieldId_idx`(`fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadFieldOptionValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadFieldOptionValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `LeadFieldOptionValue_leadId_fieldId_optionId_key`(`leadId`, `fieldId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadFieldUserValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadFieldUserValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `LeadFieldUserValue_leadId_fieldId_userId_key`(`leadId`, `fieldId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadFieldFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeadFieldFile_fieldId_idx`(`fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactFieldOptionValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contactId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactFieldOptionValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `ContactFieldOptionValue_contactId_fieldId_optionId_key`(`contactId`, `fieldId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactFieldUserValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contactId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactFieldUserValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `ContactFieldUserValue_contactId_fieldId_userId_key`(`contactId`, `fieldId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactFieldFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contactId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContactFieldFile_fieldId_idx`(`fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyFieldOptionValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompanyFieldOptionValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `CompanyFieldOptionValue_companyId_fieldId_optionId_key`(`companyId`, `fieldId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyFieldUserValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompanyFieldUserValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `CompanyFieldUserValue_companyId_fieldId_userId_key`(`companyId`, `fieldId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyFieldFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyFieldFile_fieldId_idx`(`fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomFieldOption` ADD CONSTRAINT `CustomFieldOption_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldValue` ADD CONSTRAINT `DealFieldValue_valueUserId_fkey` FOREIGN KEY (`valueUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldValue` ADD CONSTRAINT `DealFieldValue_valueOptionId_fkey` FOREIGN KEY (`valueOptionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldOptionValue` ADD CONSTRAINT `DealFieldOptionValue_dealId_fkey` FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldOptionValue` ADD CONSTRAINT `DealFieldOptionValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldOptionValue` ADD CONSTRAINT `DealFieldOptionValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldUserValue` ADD CONSTRAINT `DealFieldUserValue_dealId_fkey` FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldUserValue` ADD CONSTRAINT `DealFieldUserValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldUserValue` ADD CONSTRAINT `DealFieldUserValue_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldFile` ADD CONSTRAINT `DealFieldFile_dealId_fkey` FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealFieldFile` ADD CONSTRAINT `DealFieldFile_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldValue` ADD CONSTRAINT `LeadFieldValue_valueUserId_fkey` FOREIGN KEY (`valueUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldValue` ADD CONSTRAINT `LeadFieldValue_valueOptionId_fkey` FOREIGN KEY (`valueOptionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldOptionValue` ADD CONSTRAINT `LeadFieldOptionValue_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldOptionValue` ADD CONSTRAINT `LeadFieldOptionValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldOptionValue` ADD CONSTRAINT `LeadFieldOptionValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldUserValue` ADD CONSTRAINT `LeadFieldUserValue_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldUserValue` ADD CONSTRAINT `LeadFieldUserValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldUserValue` ADD CONSTRAINT `LeadFieldUserValue_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldFile` ADD CONSTRAINT `LeadFieldFile_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldFile` ADD CONSTRAINT `LeadFieldFile_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldValue` ADD CONSTRAINT `ContactFieldValue_valueUserId_fkey` FOREIGN KEY (`valueUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldValue` ADD CONSTRAINT `ContactFieldValue_valueOptionId_fkey` FOREIGN KEY (`valueOptionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldOptionValue` ADD CONSTRAINT `ContactFieldOptionValue_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldOptionValue` ADD CONSTRAINT `ContactFieldOptionValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldOptionValue` ADD CONSTRAINT `ContactFieldOptionValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldUserValue` ADD CONSTRAINT `ContactFieldUserValue_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldUserValue` ADD CONSTRAINT `ContactFieldUserValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldUserValue` ADD CONSTRAINT `ContactFieldUserValue_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldFile` ADD CONSTRAINT `ContactFieldFile_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldFile` ADD CONSTRAINT `ContactFieldFile_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldValue` ADD CONSTRAINT `CompanyFieldValue_valueUserId_fkey` FOREIGN KEY (`valueUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldValue` ADD CONSTRAINT `CompanyFieldValue_valueOptionId_fkey` FOREIGN KEY (`valueOptionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldOptionValue` ADD CONSTRAINT `CompanyFieldOptionValue_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldOptionValue` ADD CONSTRAINT `CompanyFieldOptionValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldOptionValue` ADD CONSTRAINT `CompanyFieldOptionValue_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `CustomFieldOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldUserValue` ADD CONSTRAINT `CompanyFieldUserValue_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldUserValue` ADD CONSTRAINT `CompanyFieldUserValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldUserValue` ADD CONSTRAINT `CompanyFieldUserValue_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldFile` ADD CONSTRAINT `CompanyFieldFile_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldFile` ADD CONSTRAINT `CompanyFieldFile_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
