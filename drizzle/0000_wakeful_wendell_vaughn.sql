CREATE TABLE `donations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`donor_id` integer,
	`donor_name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'ILS' NOT NULL,
	`date` text NOT NULL,
	`payment_method` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`donor_id`) REFERENCES `donor_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `donor_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'יחיד' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`preferred_method` text DEFAULT 'WhatsApp' NOT NULL,
	`status` text DEFAULT 'פעיל' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`period` text NOT NULL,
	`review_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'בינונית' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
