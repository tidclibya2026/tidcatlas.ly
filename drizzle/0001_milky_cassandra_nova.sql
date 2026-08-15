CREATE TABLE `atlas_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`details` text,
	`actorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `atlas_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointId` int NOT NULL,
	`storageKey` text,
	`imageUrl` text NOT NULL,
	`sourceUrl` text,
	`sourceKind` enum('agency','photographer','web_page','facebook','kml','other') NOT NULL DEFAULT 'other',
	`ownerName` varchar(255),
	`photographerName` varchar(255),
	`license` varchar(255),
	`rightsNote` text NOT NULL,
	`rightsWarning` boolean NOT NULL DEFAULT true,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_import_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`sourceKind` enum('kml','excel') NOT NULL,
	`storageKey` text,
	`status` enum('uploaded','processing','needs_review','completed','failed') NOT NULL DEFAULT 'uploaded',
	`totalRows` int NOT NULL DEFAULT 0,
	`importedRows` int NOT NULL DEFAULT 0,
	`duplicateRows` int NOT NULL DEFAULT 0,
	`rejectedRows` int NOT NULL DEFAULT 0,
	`errorSummary` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `atlas_points_layer_status_idx` ON `atlas_points`;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `sourceKind` enum('kml','excel','agency','web_page','facebook','other') DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `sourceRecordId` varchar(255);--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `recordStatus` enum('draft','pending_review','approved','published','rejected','archived') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `reviewNote` text;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `duplicateOfId` int;--> statement-breakpoint
ALTER TABLE `atlas_points` ADD `fingerprint` varchar(128);--> statement-breakpoint
CREATE INDEX `atlas_audit_entity_idx` ON `atlas_audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `atlas_images_point_idx` ON `atlas_images` (`pointId`);--> statement-breakpoint
CREATE INDEX `atlas_images_review_idx` ON `atlas_images` (`reviewStatus`);--> statement-breakpoint
CREATE INDEX `atlas_import_jobs_status_idx` ON `atlas_import_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `atlas_points_fingerprint_idx` ON `atlas_points` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `atlas_points_layer_status_idx` ON `atlas_points` (`layerId`,`recordStatus`);