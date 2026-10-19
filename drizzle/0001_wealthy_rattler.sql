CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`action` varchar(80) NOT NULL,
	`recordType` varchar(80) NOT NULL,
	`recordId` int,
	`details` text,
	`happenedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `businessSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`initialBudgetCents` bigint NOT NULL DEFAULT 2500000,
	`initialInvestorName` varchar(180) NOT NULL DEFAULT 'Gale',
	`turnoverTargetDays` int NOT NULL DEFAULT 7,
	`purchasingLocation` varchar(180) NOT NULL DEFAULT 'Divisoria, Philippines',
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `capitalTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('contribution','withdrawal','distribution') NOT NULL,
	`investorId` int,
	`amountCents` bigint NOT NULL,
	`cashLocation` enum('owner','operator','business_account') NOT NULL,
	`happenedAt` timestamp NOT NULL,
	`reference` varchar(180),
	`idempotencyKey` varchar(100) NOT NULL,
	`notes` text,
	`authorizedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capitalTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `capital_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `cashMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('capital_contribution','supplier_payment','sale_collection','expense','customer_refund','operator_remittance','withdrawal','profit_distribution','other','transfer') NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`location` enum('owner','operator','business_account') NOT NULL,
	`holderUserId` int,
	`deliveryId` int,
	`amountCents` bigint NOT NULL,
	`method` enum('cash','bank_transfer','e_wallet','check','other') NOT NULL DEFAULT 'cash',
	`sourceType` varchar(40),
	`sourceId` int,
	`transferGroupId` varchar(80),
	`idempotencyKey` varchar(100) NOT NULL,
	`reference` varchar(180),
	`note` text,
	`occurredAt` timestamp NOT NULL,
	`actorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashMovements_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_movements_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `cashReconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`location` enum('owner','operator','business_account') NOT NULL,
	`holderUserId` int,
	`expectedCents` bigint NOT NULL,
	`countedCents` bigint NOT NULL,
	`differenceCents` bigint NOT NULL,
	`notes` text,
	`countedBy` int NOT NULL,
	`countedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashReconciliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_reconciliation_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`deliveryId` int,
	`kind` enum('collection','refund') NOT NULL DEFAULT 'collection',
	`amountCents` bigint NOT NULL,
	`method` enum('cash','bank_transfer','e_wallet','check','other') NOT NULL DEFAULT 'cash',
	`cashLocation` enum('owner','operator','business_account') NOT NULL,
	`reference` varchar(180),
	`idempotencyKey` varchar(80) NOT NULL,
	`collectedAt` timestamp NOT NULL,
	`collectedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_idempotency_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `collections_reference_unique` UNIQUE(`saleId`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeName` varchar(180) NOT NULL,
	`contactName` varchar(180),
	`contact` varchar(180),
	`address` text,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryNo` varchar(40) NOT NULL,
	`saleId` int NOT NULL,
	`operatorId` int NOT NULL,
	`status` enum('assigned','delivered','returned','discrepancy') NOT NULL DEFAULT 'assigned',
	`assignedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `deliveries_number_unique` UNIQUE(`deliveryNo`),
	CONSTRAINT `deliveries_sale_unique` UNIQUE(`saleId`)
);
--> statement-breakpoint
CREATE TABLE `deliveryLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryId` int NOT NULL,
	`saleLineId` int NOT NULL,
	`productId` int NOT NULL,
	`assignedPacks` int NOT NULL,
	`returnedPacks` int NOT NULL DEFAULT 0,
	CONSTRAINT `deliveryLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` varchar(240) NOT NULL,
	`invoiceAmountCents` bigint NOT NULL,
	`amountCents` bigint NOT NULL,
	`cashPaidCents` bigint NOT NULL DEFAULT 0,
	`expenseDate` timestamp NOT NULL,
	`status` enum('paid','unpaid') NOT NULL DEFAULT 'unpaid',
	`costType` enum('purchase','operations') NOT NULL DEFAULT 'operations',
	`purchaseId` int,
	`deliveryId` int,
	`receiptRef` varchar(180),
	`sharedVehicle` boolean NOT NULL DEFAULT false,
	`allocationBps` int NOT NULL DEFAULT 10000,
	`allocationBasis` varchar(180),
	`externalAllocationRef` varchar(180),
	`paidFrom` enum('owner','operator','business_account'),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenses_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`kind` enum('receipt','sale','customer_return','supplier_return','damage','stock_count','adjustment','reversal') NOT NULL,
	`quantityDelta` int NOT NULL,
	`unitCostCents` bigint NOT NULL,
	`costValueCents` bigint NOT NULL,
	`sourceType` varchar(40),
	`sourceId` int,
	`idempotencyKey` varchar(100) NOT NULL,
	`notes` text,
	`actorId` int,
	`movedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_movements_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `investors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `investors_id` PRIMARY KEY(`id`),
	CONSTRAINT `investors_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ownershipRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`investorId` int NOT NULL,
	`percentageBps` int NOT NULL,
	`effectiveDate` date NOT NULL,
	`agreementReference` varchar(180),
	`authorizedBy` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownershipRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `ownership_investor_date_unique` UNIQUE(`investorId`,`effectiveDate`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`variety` varchar(180),
	`packDescription` varchar(180) NOT NULL,
	`piecesPerPack` int,
	`active` boolean NOT NULL DEFAULT true,
	`averageCostCents` bigint NOT NULL DEFAULT 0,
	`defaultPriceCents` bigint NOT NULL DEFAULT 0,
	`reorderPacks` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `purchaseLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseId` int NOT NULL,
	`productId` int NOT NULL,
	`packs` int NOT NULL,
	`unitCostCents` bigint NOT NULL,
	`lineSubtotalCents` bigint NOT NULL,
	`allocatedCostCents` bigint NOT NULL,
	`landedLineCents` bigint NOT NULL,
	`landedUnitCostCents` bigint NOT NULL,
	CONSTRAINT `purchaseLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseNo` varchar(40) NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`supplierId` int,
	`supplierName` varchar(180) NOT NULL,
	`purchaseDate` timestamp NOT NULL,
	`sourceLocation` varchar(180) NOT NULL DEFAULT 'Divisoria, Philippines',
	`subtotalCents` bigint NOT NULL,
	`acquisitionCostsCents` bigint NOT NULL DEFAULT 0,
	`landedCostCents` bigint NOT NULL,
	`status` enum('draft','received','cancelled') NOT NULL DEFAULT 'draft',
	`receiptRef` varchar(180),
	`notes` text,
	`operatorId` int,
	`createdBy` int,
	`ownerApprovedAt` timestamp,
	`ownerApprovedBy` int,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchases_number_unique` UNIQUE(`purchaseNo`),
	CONSTRAINT `purchases_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `saleLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(180) NOT NULL,
	`packs` int NOT NULL,
	`unitPriceCents` bigint NOT NULL,
	`lineDiscountCents` bigint NOT NULL DEFAULT 0,
	`lineTotalCents` bigint NOT NULL,
	`unitCostCents` bigint NOT NULL,
	`cogsCents` bigint NOT NULL,
	CONSTRAINT `saleLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleNo` varchar(40) NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`customerId` int,
	`storeName` varchar(180) NOT NULL,
	`saleDate` timestamp NOT NULL,
	`grossCents` bigint NOT NULL,
	`discountCents` bigint NOT NULL DEFAULT 0,
	`totalCents` bigint NOT NULL,
	`status` enum('completed','reversed') NOT NULL DEFAULT 'completed',
	`deliveryStatus` enum('not_required','pending','assigned','delivered','returned') NOT NULL DEFAULT 'pending',
	`operatorId` int,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_number_unique` UNIQUE(`saleNo`),
	CONSTRAINT `sales_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `salesReturns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`saleId` int NOT NULL,
	`saleLineId` int NOT NULL,
	`productId` int NOT NULL,
	`packs` int NOT NULL,
	`creditCents` bigint NOT NULL,
	`restockable` boolean NOT NULL,
	`reason` varchar(240) NOT NULL,
	`returnedAt` timestamp NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salesReturns_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_returns_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `supplierPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseId` int NOT NULL,
	`amountCents` bigint NOT NULL,
	`method` enum('cash','bank_transfer','e_wallet','check','other') NOT NULL DEFAULT 'cash',
	`cashLocation` enum('owner','operator','business_account') NOT NULL,
	`reference` varchar(180),
	`idempotencyKey` varchar(80) NOT NULL,
	`paidAt` timestamp NOT NULL,
	`paidBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplierPayments_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_payments_idempotency_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `supplier_payments_reference_unique` UNIQUE(`purchaseId`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`contact` varchar(180),
	`address` text,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('pending','operator','owner','user','admin') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `businessSettings` ADD CONSTRAINT `businessSettings_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD CONSTRAINT `capitalTransactions_investorId_investors_id_fk` FOREIGN KEY (`investorId`) REFERENCES `investors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD CONSTRAINT `capitalTransactions_authorizedBy_users_id_fk` FOREIGN KEY (`authorizedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashMovements` ADD CONSTRAINT `cashMovements_holderUserId_users_id_fk` FOREIGN KEY (`holderUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashMovements` ADD CONSTRAINT `cashMovements_deliveryId_deliveries_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashMovements` ADD CONSTRAINT `cashMovements_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashReconciliations` ADD CONSTRAINT `cashReconciliations_holderUserId_users_id_fk` FOREIGN KEY (`holderUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashReconciliations` ADD CONSTRAINT `cashReconciliations_countedBy_users_id_fk` FOREIGN KEY (`countedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_collectedBy_users_id_fk` FOREIGN KEY (`collectedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveries` ADD CONSTRAINT `deliveries_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveries` ADD CONSTRAINT `deliveries_operatorId_users_id_fk` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveries` ADD CONSTRAINT `deliveries_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveryLines` ADD CONSTRAINT `deliveryLines_deliveryId_deliveries_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveryLines` ADD CONSTRAINT `deliveryLines_saleLineId_saleLines_id_fk` FOREIGN KEY (`saleLineId`) REFERENCES `saleLines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveryLines` ADD CONSTRAINT `deliveryLines_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_purchaseId_purchases_id_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_deliveryId_deliveries_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD CONSTRAINT `inventoryMovements_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryMovements` ADD CONSTRAINT `inventoryMovements_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ownershipRecords` ADD CONSTRAINT `ownershipRecords_investorId_investors_id_fk` FOREIGN KEY (`investorId`) REFERENCES `investors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ownershipRecords` ADD CONSTRAINT `ownershipRecords_authorizedBy_users_id_fk` FOREIGN KEY (`authorizedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseLines` ADD CONSTRAINT `purchaseLines_purchaseId_purchases_id_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchaseLines` ADD CONSTRAINT `purchaseLines_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_operatorId_users_id_fk` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_ownerApprovedBy_users_id_fk` FOREIGN KEY (`ownerApprovedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleLines` ADD CONSTRAINT `saleLines_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saleLines` ADD CONSTRAINT `saleLines_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_operatorId_users_id_fk` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesReturns` ADD CONSTRAINT `salesReturns_saleId_sales_id_fk` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesReturns` ADD CONSTRAINT `salesReturns_saleLineId_saleLines_id_fk` FOREIGN KEY (`saleLineId`) REFERENCES `saleLines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesReturns` ADD CONSTRAINT `salesReturns_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesReturns` ADD CONSTRAINT `salesReturns_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierPayments` ADD CONSTRAINT `supplierPayments_purchaseId_purchases_id_fk` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplierPayments` ADD CONSTRAINT `supplierPayments_paidBy_users_id_fk` FOREIGN KEY (`paidBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_date_idx` ON `auditLogs` (`happenedAt`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `auditLogs` (`actorId`);--> statement-breakpoint
CREATE INDEX `capital_date_idx` ON `capitalTransactions` (`happenedAt`);--> statement-breakpoint
CREATE INDEX `cash_movements_location_date_idx` ON `cashMovements` (`location`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `cash_movements_delivery_idx` ON `cashMovements` (`deliveryId`);--> statement-breakpoint
CREATE INDEX `cash_reconciliation_date_idx` ON `cashReconciliations` (`location`,`countedAt`);--> statement-breakpoint
CREATE INDEX `collections_date_idx` ON `collections` (`collectedAt`);--> statement-breakpoint
CREATE INDEX `customers_store_idx` ON `customers` (`storeName`);--> statement-breakpoint
CREATE INDEX `deliveries_operator_status_idx` ON `deliveries` (`operatorId`,`status`);--> statement-breakpoint
CREATE INDEX `inventory_movements_product_date_idx` ON `inventoryMovements` (`productId`,`movedAt`);--> statement-breakpoint
CREATE INDEX `ownership_investor_date_idx` ON `ownershipRecords` (`investorId`,`effectiveDate`);--> statement-breakpoint
CREATE INDEX `products_active_idx` ON `products` (`active`);--> statement-breakpoint
CREATE INDEX `purchases_date_idx` ON `purchases` (`purchaseDate`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`saleDate`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customerId`);