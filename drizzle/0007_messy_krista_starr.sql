ALTER TABLE `donations` ADD `person_id` integer REFERENCES people(id);--> statement-breakpoint
ALTER TABLE `engagements` ADD `person_id` integer REFERENCES people(id);