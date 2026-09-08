CREATE INDEX `idx_donations_donor_type_date` ON `donations` (`donor_id`,`movement_type`,`date`);--> statement-breakpoint
CREATE INDEX `idx_engagements_donor_occurred` ON `engagements` (`donor_card_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_people_donor_card` ON `people` (`donor_card_id`);--> statement-breakpoint
CREATE INDEX `idx_special_dates_donor_card` ON `special_dates` (`donor_card_id`);--> statement-breakpoint
CREATE INDEX `idx_special_dates_person` ON `special_dates` (`person_id`);--> statement-breakpoint
PRAGMA optimize;
