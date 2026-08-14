CREATE TABLE `atlas_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`layerId` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`municipality` varchar(160),
	`category` varchar(120),
	`source` varchar(255),
	`metadata` text,
	`imageUrl` text,
	`imageKey` text,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `atlas_points_layer_status_idx` ON `atlas_points` (`layerId`,`status`);--> statement-breakpoint
CREATE INDEX `atlas_points_coordinates_idx` ON `atlas_points` (`latitude`,`longitude`);