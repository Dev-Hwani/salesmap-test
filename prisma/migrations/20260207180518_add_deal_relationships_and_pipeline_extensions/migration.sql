-- AlterTable
ALTER TABLE `deal` ADD COLUMN `companyId` INTEGER NULL,
    ADD COLUMN `contactId` INTEGER NULL,
    ADD COLUMN `sourceLeadId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Deal_companyId_idx` ON `Deal`(`companyId`);

-- CreateIndex
CREATE INDEX `Deal_contactId_idx` ON `Deal`(`contactId`);

-- CreateIndex
CREATE INDEX `Deal_sourceLeadId_idx` ON `Deal`(`sourceLeadId`);

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_sourceLeadId_fkey` FOREIGN KEY (`sourceLeadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
