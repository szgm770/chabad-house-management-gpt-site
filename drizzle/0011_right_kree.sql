ALTER TABLE `donor_cards` ADD `manual_relationship_groups` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `automatic_relationship_groups` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `relationship_status` text DEFAULT 'needs_contact' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `relationship_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `relationship_handled_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `eligible_for_recurring_increase` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `priority_rank` integer DEFAULT 99 NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `priority_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_donor_cards_relationship_rank` ON `donor_cards` (`priority_rank`,`priority_score`);--> statement-breakpoint
CREATE INDEX `idx_donor_cards_follow_up` ON `donor_cards` (`relationship_status`,`next_contact_date`);