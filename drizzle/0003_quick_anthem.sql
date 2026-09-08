CREATE TABLE `payment_declines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text DEFAULT 'nedarim-plus' NOT NULL,
	`external_id` text,
	`recurring_id` text,
	`donor_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`id_number` text DEFAULT '' NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'ILS' NOT NULL,
	`message` text NOT NULL,
	`decline_source` text DEFAULT 'Transaction' NOT NULL,
	`occurred_at` text NOT NULL,
	`raw_json` text DEFAULT '{}' NOT NULL,
	`handled` integer DEFAULT false NOT NULL,
	`handled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
