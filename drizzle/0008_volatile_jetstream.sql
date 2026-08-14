CREATE TABLE `atlas_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointId` int,
	`userId` int NOT NULL,
	`suggestionType` enum('edit','image') NOT NULL,
	`proposedName` varchar(255),
	`proposedDescription` text,
	`proposedCategory` varchar(120),
	`proposedMetadata` text,
	`imageUrl` text,
	`storageKey` text,
	`sourceUrl` text,
	`sourceKind` enum('agency','photographer','web_page','facebook','wikimedia','kml','excel','custom','other') NOT NULL DEFAULT 'other',
	`ownerName` varchar(255),
	`photographerName` varchar(255),
	`license` varchar(255),
	`rightsNote` text,
	`status` enum('pending','approved','rejected','archived') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `atlas_suggestions_point_idx` ON `atlas_suggestions` (`pointId`);--> statement-breakpoint
CREATE INDEX `atlas_suggestions_status_idx` ON `atlas_suggestions` (`status`);--> statement-breakpoint
CREATE INDEX `atlas_suggestions_user_idx` ON `atlas_suggestions` (`userId`);