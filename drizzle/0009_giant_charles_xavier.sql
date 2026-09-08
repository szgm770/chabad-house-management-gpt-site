ALTER TABLE `donor_cards` ADD `card_name_mode` text DEFAULT 'AUTO' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `linked_people_ids` text DEFAULT '[]' NOT NULL;