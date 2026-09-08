ALTER TABLE `donor_cards` ADD `alias` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `secondary_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `special_dates` ADD `donor_card_id` integer REFERENCES donor_cards(id);--> statement-breakpoint
ALTER TABLE `special_dates` ADD `custom_name` text DEFAULT '' NOT NULL;