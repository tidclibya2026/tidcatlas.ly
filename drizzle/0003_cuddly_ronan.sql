CREATE TABLE `atlas_backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`storageKey` varchar(700),
	`status` enum('creating','completed','failed') NOT NULL DEFAULT 'creating',
	`sizeBytes` int,
	`errorSummary` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `atlas_backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `atlas_backups_status_idx` ON `atlas_backups` (`status`);--> statement-breakpoint
CREATE INDEX `atlas_backups_created_at_idx` ON `atlas_backups` (`createdAt`);