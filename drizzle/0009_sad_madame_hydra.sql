CREATE TABLE `atlas_top150_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queueVersion` varchar(40) NOT NULL,
	`rank` int NOT NULL,
	`candidate` varchar(255) NOT NULL,
	`region` varchar(160),
	`confirmedName` varchar(255),
	`matchScore` double NOT NULL,
	`status` enum('pending_review','approved','rejected') NOT NULL DEFAULT 'pending_review',
	`reviewNote` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`sourceReport` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atlas_top150_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `atlas_top150_queue_rank_uidx` UNIQUE(`queueVersion`,`rank`)
);
--> statement-breakpoint
CREATE INDEX `atlas_top150_status_idx` ON `atlas_top150_reviews` (`status`);