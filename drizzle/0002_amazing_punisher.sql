ALTER TABLE `donations` ADD `movement_type` text DEFAULT 'donation' NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `match_status` text DEFAULT 'matched' NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `match_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `id_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `address` text DEFAULT '' NOT NULL;