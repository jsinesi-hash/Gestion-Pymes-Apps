CREATE TABLE `demo_registro` (
	`id` text PRIMARY KEY NOT NULL,
	`tabla` text NOT NULL,
	`registro_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
