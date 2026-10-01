CREATE TABLE `dialogue_node_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dialogue` text NOT NULL,
	`node_id` text NOT NULL,
	`text_content` text,
	`speaker` text,
	`constructor` text,
	`category` text,
	`next_node_ids` text DEFAULT '[]' NOT NULL,
	`fetched_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dialogue_node_unique` ON `dialogue_node_metadata` (`dialogue`,`node_id`);--> statement-breakpoint
CREATE INDEX `dialogue_metadata_dialogue_idx` ON `dialogue_node_metadata` (`dialogue`);--> statement-breakpoint
CREATE INDEX `dialogue_metadata_speaker_idx` ON `dialogue_node_metadata` (`speaker`);