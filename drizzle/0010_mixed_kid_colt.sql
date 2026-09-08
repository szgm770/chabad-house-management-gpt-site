CREATE TABLE `attention_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`donor_card_id` integer,
	`person_id` integer,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`dedupe_key` text NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attention_dedupe_key` ON `attention_items` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_attention_status_due` ON `attention_items` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_attention_card` ON `attention_items` (`donor_card_id`);--> statement-breakpoint
CREATE TABLE `duplicate_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pair_key` text NOT NULL,
	`left_donor_card_id` integer,
	`right_donor_card_id` integer,
	`decision` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`left_donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`right_donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duplicate_decisions_pair_key_unique` ON `duplicate_decisions` (`pair_key`);--> statement-breakpoint
CREATE TABLE `merge_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`survivor_person_id` integer,
	`merged_person_id` integer,
	`target_donor_card_id` integer,
	`snapshot_json` text NOT NULL,
	`status` text DEFAULT 'applied' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reverted_at` text,
	FOREIGN KEY (`survivor_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merged_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring_commitments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`donor_card_id` integer NOT NULL,
	`person_id` integer,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'ILS' NOT NULL,
	`payment_method` text NOT NULL,
	`start_date` text NOT NULL,
	`duration_months` integer,
	`expected_day` integer NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`external_id` text,
	`alert_days_before` integer DEFAULT 30 NOT NULL,
	`raw_payload` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_card_status` ON `recurring_commitments` (`donor_card_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recurring_source_external` ON `recurring_commitments` (`source`,`external_id`);--> statement-breakpoint
ALTER TABLE `review_recipients` ADD `donor_card_id` integer REFERENCES donor_cards(id);--> statement-breakpoint
ALTER TABLE `review_recipients` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_recipients` ADD `issue` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `include_recurring` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `donor_card_id` integer REFERENCES donor_cards(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `person_id` integer REFERENCES people(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` text;--> statement-breakpoint
CREATE INDEX `idx_donations_source_external` ON `donations` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_donations_match_status` ON `donations` (`match_status`);
