ALTER TABLE `cliente` ADD `localidad_id` text REFERENCES localidad(id);--> statement-breakpoint
ALTER TABLE `proveedor` ADD `localidad_id` text REFERENCES localidad(id);