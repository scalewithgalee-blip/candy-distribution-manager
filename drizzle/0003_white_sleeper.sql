CREATE TABLE `expenseAdjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`deltaCents` bigint NOT NULL,
	`previousAmountCents` bigint NOT NULL,
	`newAmountCents` bigint NOT NULL,
	`reference` varchar(180) NOT NULL,
	`reason` text NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`adjustedAt` timestamp NOT NULL,
	`adjustedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenseAdjustments_id` PRIMARY KEY(`id`),
	CONSTRAINT `expense_adjustments_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `expenseAdjustments` ADD CONSTRAINT `expenseAdjustments_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenseAdjustments` ADD CONSTRAINT `expenseAdjustments_adjustedBy_users_id_fk` FOREIGN KEY (`adjustedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expense_adjustments_expense_idx` ON `expenseAdjustments` (`expenseId`,`adjustedAt`);