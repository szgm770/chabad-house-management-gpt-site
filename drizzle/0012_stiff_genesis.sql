ALTER TABLE `donations` ADD `expected_settlement_date` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `actual_settlement_date` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `settlement_review` integer DEFAULT false NOT NULL;