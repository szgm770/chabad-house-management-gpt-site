ALTER TABLE `donations` ADD `department` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `subcategory` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `raw_payload` text DEFAULT '{}' NOT NULL;