CREATE TABLE `atlas_team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`displayName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`teamRole` enum('reviewer','editor','import_manager') NOT NULL DEFAULT 'reviewer',
	`status` enum('active','suspended','pending') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `atlas_team_members_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `atlas_team_members_status_idx` ON `atlas_team_members` (`status`);--> statement-breakpoint
CREATE INDEX `atlas_team_members_role_idx` ON `atlas_team_members` (`teamRole`);