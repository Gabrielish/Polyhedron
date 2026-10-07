ALTER TABLE `dictionary` ADD `text_language1_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `dictionary` ADD `text_language2_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `dictionary_match_idx` ON `dictionary` (`language1`,`language2`,`mod_name`,`text_language1_key`);--> statement-breakpoint
CREATE INDEX `dictionary_match_uid_idx` ON `dictionary` (`language1`,`language2`,`mod_name`,`uid`,`text_language1_key`);--> statement-breakpoint
UPDATE `dictionary` SET
  `text_language1_key` = lower(trim(`text_language1`)),
  `text_language2_key` = lower(trim(`text_language2`));