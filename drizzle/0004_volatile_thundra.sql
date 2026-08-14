CREATE TABLE `atlas_layers` (
	`id` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`description` text,
	`color` varchar(20) NOT NULL DEFAULT '#287a70',
	`icon` varchar(80) NOT NULL DEFAULT 'map-pin',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_layers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `atlas_layers_status_idx` ON `atlas_layers` (`status`);