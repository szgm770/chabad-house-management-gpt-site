CREATE TABLE `feedback_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text NOT NULL,
	`category` text DEFAULT 'suggestion' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`handled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
