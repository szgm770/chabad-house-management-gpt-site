CREATE TABLE `bank_reconciliations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`currency` text DEFAULT 'ILS' NOT NULL,
	`expected_balance` real NOT NULL,
	`actual_balance` real NOT NULL,
	`difference` real NOT NULL,
	`matched` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`verified_by` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bank_reconciliation_date_currency` ON `bank_reconciliations` (`date`,`currency`);