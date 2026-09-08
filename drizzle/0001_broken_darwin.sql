CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `engagements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`donor_card_id` integer,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`occurred_at` text NOT NULL,
	`follow_up_date` text,
	`outcome` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`filename` text NOT NULL,
	`fingerprint` text NOT NULL,
	`rows_total` integer DEFAULT 0 NOT NULL,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_runs_fingerprint_unique` ON `import_runs` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`donor_card_id` integer,
	`full_name` text NOT NULL,
	`greeting_name` text DEFAULT '' NOT NULL,
	`alternative_names` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`secondary_phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`postal_address` text DEFAULT '' NOT NULL,
	`id_number` text DEFAULT '' NOT NULL,
	`preferred_method` text DEFAULT 'WhatsApp' NOT NULL,
	`do_not_send` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`donor_card_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_recipients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_id` integer,
	`person_id` integer,
	`greeting_name` text NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`method` text NOT NULL,
	`received` integer DEFAULT false NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `special_dates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer,
	`kind` text NOT NULL,
	`hebrew_day` integer NOT NULL,
	`hebrew_month` text NOT NULL,
	`hebrew_year` integer,
	`civil_date` text,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `donations` ADD `reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `fee_percentage` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `fee_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `net_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `is_recurring` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `import_fingerprint` text;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `cultivation_priority` text DEFAULT 'רגילה' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `estimated_capacity` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `interests` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `connection` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `next_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `next_contact_date` text;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `recurring_status` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `recurring_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `recurring_day` integer;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `recurring_start_date` text;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `recurring_end_date` text;--> statement-breakpoint
ALTER TABLE `donor_cards` ADD `fundraising_rank` integer DEFAULT 99 NOT NULL;