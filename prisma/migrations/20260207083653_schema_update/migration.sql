-- AlterTable
ALTER TABLE `customfield` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `masked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `objectType` ENUM('DEAL', 'LEAD', 'CONTACT', 'COMPANY') NOT NULL DEFAULT 'DEAL',
    ADD COLUMN `required` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `type` ENUM('text', 'number', 'date', 'datetime') NOT NULL;

-- AlterTable
ALTER TABLE `dealfieldvalue` ADD COLUMN `valueDateTime` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Lead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `companyId` INTEGER NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'LOST') NOT NULL DEFAULT 'NEW',
    `ownerId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Lead_ownerId_idx`(`ownerId`),
    INDEX `Lead_companyId_idx`(`companyId`),
    INDEX `Lead_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `companyId` INTEGER NULL,
    `ownerId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Contact_ownerId_idx`(`ownerId`),
    INDEX `Contact_companyId_idx`(`companyId`),
    INDEX `Contact_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `ownerId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Company_ownerId_idx`(`ownerId`),
    INDEX `Company_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadFieldValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `valueText` VARCHAR(191) NULL,
    `valueNumber` DOUBLE NULL,
    `valueDate` DATETIME(3) NULL,
    `valueDateTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeadFieldValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `LeadFieldValue_leadId_fieldId_key`(`leadId`, `fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactFieldValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contactId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `valueText` VARCHAR(191) NULL,
    `valueNumber` DOUBLE NULL,
    `valueDate` DATETIME(3) NULL,
    `valueDateTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContactFieldValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `ContactFieldValue_contactId_fieldId_key`(`contactId`, `fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyFieldValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `fieldId` INTEGER NOT NULL,
    `valueText` VARCHAR(191) NULL,
    `valueNumber` DOUBLE NULL,
    `valueDate` DATETIME(3) NULL,
    `valueDateTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyFieldValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `CompanyFieldValue_companyId_fieldId_key`(`companyId`, `fieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CustomField_objectType_deletedAt_idx` ON `CustomField`(`objectType`, `deletedAt`);

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Company` ADD CONSTRAINT `Company_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldValue` ADD CONSTRAINT `LeadFieldValue_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFieldValue` ADD CONSTRAINT `LeadFieldValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldValue` ADD CONSTRAINT `ContactFieldValue_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactFieldValue` ADD CONSTRAINT `ContactFieldValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldValue` ADD CONSTRAINT `CompanyFieldValue_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyFieldValue` ADD CONSTRAINT `CompanyFieldValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `CustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
