CREATE TABLE `atlas_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`status` enum('pending','approved','rejected','archived') NOT NULL DEFAULT 'pending',
	`moderatedBy` int,
	`moderatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atlas_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pointId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `atlas_comments_point_idx` ON `atlas_comments` (`pointId`);--> statement-breakpoint
CREATE INDEX `atlas_comments_status_idx` ON `atlas_comments` (`status`);--> statement-breakpoint
CREATE INDEX `atlas_comments_user_idx` ON `atlas_comments` (`userId`);--> statement-breakpoint
CREATE INDEX `atlas_ratings_point_idx` ON `atlas_ratings` (`pointId`);--> statement-breakpoint
CREATE INDEX `atlas_ratings_user_idx` ON `atlas_ratings` (`userId`);