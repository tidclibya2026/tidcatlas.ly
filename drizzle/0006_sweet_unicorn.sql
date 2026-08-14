ALTER TABLE `atlas_images` MODIFY COLUMN `sourceKind` enum('agency','photographer','web_page','facebook','wikimedia','kml','excel','custom','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `atlas_images` ADD `sourceRecordId` varchar(255);--> statement-breakpoint
ALTER TABLE `atlas_images` ADD `sourceFileName` varchar(255);--> statement-breakpoint
ALTER TABLE `atlas_images` ADD `assetHash` varchar(128);--> statement-breakpoint
ALTER TABLE `atlas_images` ADD `importJobId` int;--> statement-breakpoint
CREATE INDEX `atlas_images_point_source_idx` ON `atlas_images` (`pointId`,`sourceKind`);--> statement-breakpoint
CREATE INDEX `atlas_images_asset_hash_idx` ON `atlas_images` (`assetHash`);