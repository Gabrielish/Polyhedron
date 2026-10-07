CREATE INDEX `dictionary_langs_idx` ON `dictionary` (`language1`,`language2`);--> statement-breakpoint
CREATE INDEX `dictionary_langs_mod_idx` ON `dictionary` (`language1`,`language2`,`mod_name`);--> statement-breakpoint
CREATE INDEX `dictionary_mod_idx` ON `dictionary` (`mod_name`);