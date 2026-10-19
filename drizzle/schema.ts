import {
  bigint,
  boolean,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["pending", "operator", "owner", "user", "admin"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    variety: varchar("variety", { length: 180 }),
    packDescription: varchar("packDescription", { length: 180 }).notNull(),
    piecesPerPack: int("piecesPerPack"),
    active: boolean("active").default(true).notNull(),
    averageCostCents: bigint("averageCostCents", { mode: "number" })
      .default(0)
      .notNull(),
    defaultPriceCents: bigint("defaultPriceCents", { mode: "number" })
      .default(0)
      .notNull(),
    reorderPacks: int("reorderPacks").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("products_sku_unique").on(table.sku),
    index("products_active_idx").on(table.active),
  ]
);

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  contact: varchar("contact", { length: 180 }),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    storeName: varchar("storeName", { length: 180 }).notNull(),
    contactName: varchar("contactName", { length: 180 }),
    contact: varchar("contact", { length: 180 }),
    address: text("address"),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("customers_store_idx").on(table.storeName)]
);

export const purchases = mysqlTable(
  "purchases",
  {
    id: int("id").autoincrement().primaryKey(),
    purchaseNo: varchar("purchaseNo", { length: 40 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    supplierId: int("supplierId").references(() => suppliers.id),
    supplierName: varchar("supplierName", { length: 180 }).notNull(),
    purchaseDate: timestamp("purchaseDate").notNull(),
    sourceLocation: varchar("sourceLocation", { length: 180 })
      .default("Divisoria, Philippines")
      .notNull(),
    subtotalCents: bigint("subtotalCents", { mode: "number" }).notNull(),
    acquisitionCostsCents: bigint("acquisitionCostsCents", { mode: "number" })
      .default(0)
      .notNull(),
    landedCostCents: bigint("landedCostCents", { mode: "number" }).notNull(),
    status: mysqlEnum("status", ["draft", "received", "cancelled"])
      .default("draft")
      .notNull(),
    receiptRef: varchar("receiptRef", { length: 180 }),
    notes: text("notes"),
    operatorId: int("operatorId").references(() => users.id),
    createdBy: int("createdBy").references(() => users.id),
    ownerApprovedAt: timestamp("ownerApprovedAt"),
    ownerApprovedBy: int("ownerApprovedBy").references(() => users.id),
    receivedAt: timestamp("receivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("purchases_number_unique").on(table.purchaseNo),
    uniqueIndex("purchases_idempotency_unique").on(table.idempotencyKey),
    index("purchases_date_idx").on(table.purchaseDate),
  ]
);

export const purchaseLines = mysqlTable("purchaseLines", {
  id: int("id").autoincrement().primaryKey(),
  purchaseId: int("purchaseId")
    .notNull()
    .references(() => purchases.id),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  packs: int("packs").notNull(),
  unitCostCents: bigint("unitCostCents", { mode: "number" }).notNull(),
  lineSubtotalCents: bigint("lineSubtotalCents", { mode: "number" }).notNull(),
  allocatedCostCents: bigint("allocatedCostCents", {
    mode: "number",
  }).notNull(),
  landedLineCents: bigint("landedLineCents", { mode: "number" }).notNull(),
  landedUnitCostCents: bigint("landedUnitCostCents", {
    mode: "number",
  }).notNull(),
});

export const supplierPayments = mysqlTable(
  "supplierPayments",
  {
    id: int("id").autoincrement().primaryKey(),
    purchaseId: int("purchaseId")
      .notNull()
      .references(() => purchases.id),
    amountCents: bigint("amountCents", { mode: "number" }).notNull(),
    method: mysqlEnum("method", [
      "cash",
      "bank_transfer",
      "e_wallet",
      "check",
      "other",
    ])
      .default("cash")
      .notNull(),
    cashLocation: mysqlEnum("cashLocation", [
      "owner",
      "operator",
      "business_account",
    ]).notNull(),
    reference: varchar("reference", { length: 180 }),
    idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull(),
    paidAt: timestamp("paidAt").notNull(),
    paidBy: int("paidBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("supplier_payments_idempotency_unique").on(
      table.idempotencyKey
    ),
    uniqueIndex("supplier_payments_reference_unique").on(
      table.purchaseId,
      table.reference
    ),
  ]
);

export const sales = mysqlTable(
  "sales",
  {
    id: int("id").autoincrement().primaryKey(),
    saleNo: varchar("saleNo", { length: 40 }).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    customerId: int("customerId").references(() => customers.id),
    storeName: varchar("storeName", { length: 180 }).notNull(),
    saleDate: timestamp("saleDate").notNull(),
    grossCents: bigint("grossCents", { mode: "number" }).notNull(),
    discountCents: bigint("discountCents", { mode: "number" })
      .default(0)
      .notNull(),
    totalCents: bigint("totalCents", { mode: "number" }).notNull(),
    status: mysqlEnum("status", ["completed", "reversed"])
      .default("completed")
      .notNull(),
    deliveryStatus: mysqlEnum("deliveryStatus", [
      "not_required",
      "pending",
      "assigned",
      "delivered",
      "returned",
      "discrepancy",
    ])
      .default("pending")
      .notNull(),
    operatorId: int("operatorId").references(() => users.id),
    notes: text("notes"),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("sales_number_unique").on(table.saleNo),
    uniqueIndex("sales_idempotency_unique").on(table.idempotencyKey),
    index("sales_date_idx").on(table.saleDate),
    index("sales_customer_idx").on(table.customerId),
  ]
);

export const saleLines = mysqlTable("saleLines", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId")
    .notNull()
    .references(() => sales.id),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  productName: varchar("productName", { length: 180 }).notNull(),
  packs: int("packs").notNull(),
  unitPriceCents: bigint("unitPriceCents", { mode: "number" }).notNull(),
  lineDiscountCents: bigint("lineDiscountCents", { mode: "number" })
    .default(0)
    .notNull(),
  lineTotalCents: bigint("lineTotalCents", { mode: "number" }).notNull(),
  unitCostCents: bigint("unitCostCents", { mode: "number" }).notNull(),
  cogsCents: bigint("cogsCents", { mode: "number" }).notNull(),
});

export const salesReturns = mysqlTable(
  "salesReturns",
  {
    id: int("id").autoincrement().primaryKey(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    saleId: int("saleId")
      .notNull()
      .references(() => sales.id),
    saleLineId: int("saleLineId")
      .notNull()
      .references(() => saleLines.id),
    productId: int("productId")
      .notNull()
      .references(() => products.id),
    packs: int("packs").notNull(),
    creditCents: bigint("creditCents", { mode: "number" }).notNull(),
    restockable: boolean("restockable").notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    returnedAt: timestamp("returnedAt").notNull(),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("sales_returns_idempotency_unique").on(table.idempotencyKey),
  ]
);

export const collections = mysqlTable(
  "collections",
  {
    id: int("id").autoincrement().primaryKey(),
    saleId: int("saleId")
      .notNull()
      .references(() => sales.id),
    deliveryId: int("deliveryId"),
    kind: mysqlEnum("kind", ["collection", "refund"])
      .default("collection")
      .notNull(),
    amountCents: bigint("amountCents", { mode: "number" }).notNull(),
    method: mysqlEnum("method", [
      "cash",
      "bank_transfer",
      "e_wallet",
      "check",
      "other",
    ])
      .default("cash")
      .notNull(),
    cashLocation: mysqlEnum("cashLocation", [
      "owner",
      "operator",
      "business_account",
    ]).notNull(),
    reference: varchar("reference", { length: 180 }),
    idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull(),
    collectedAt: timestamp("collectedAt").notNull(),
    collectedBy: int("collectedBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("collections_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("collections_reference_unique").on(
      table.saleId,
      table.reference
    ),
    index("collections_date_idx").on(table.collectedAt),
  ]
);

export const inventoryMovements = mysqlTable(
  "inventoryMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId")
      .notNull()
      .references(() => products.id),
    kind: mysqlEnum("kind", [
      "receipt",
      "sale",
      "customer_return",
      "supplier_return",
      "damage",
      "stock_count",
      "adjustment",
      "reversal",
    ]).notNull(),
    quantityDelta: int("quantityDelta").notNull(),
    unitCostCents: bigint("unitCostCents", { mode: "number" }).notNull(),
    costValueCents: bigint("costValueCents", { mode: "number" }).notNull(),
    sourceType: varchar("sourceType", { length: 40 }),
    sourceId: int("sourceId"),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    notes: text("notes"),
    actorId: int("actorId").references(() => users.id),
    movedAt: timestamp("movedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("inventory_movements_idempotency_unique").on(
      table.idempotencyKey
    ),
    index("inventory_movements_product_date_idx").on(
      table.productId,
      table.movedAt
    ),
  ]
);

export const deliveries = mysqlTable(
  "deliveries",
  {
    id: int("id").autoincrement().primaryKey(),
    deliveryNo: varchar("deliveryNo", { length: 40 }).notNull(),
    saleId: int("saleId")
      .notNull()
      .references(() => sales.id),
    operatorId: int("operatorId")
      .notNull()
      .references(() => users.id),
    status: mysqlEnum("status", [
      "assigned",
      "delivered",
      "returned",
      "discrepancy",
    ])
      .default("assigned")
      .notNull(),
    assignedAt: timestamp("assignedAt").notNull(),
    completedAt: timestamp("completedAt"),
    notes: text("notes"),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("deliveries_number_unique").on(table.deliveryNo),
    uniqueIndex("deliveries_sale_unique").on(table.saleId),
    index("deliveries_operator_status_idx").on(table.operatorId, table.status),
  ]
);

export const deliveryLines = mysqlTable("deliveryLines", {
  id: int("id").autoincrement().primaryKey(),
  deliveryId: int("deliveryId")
    .notNull()
    .references(() => deliveries.id),
  saleLineId: int("saleLineId")
    .notNull()
    .references(() => saleLines.id),
  productId: int("productId")
    .notNull()
    .references(() => products.id),
  assignedPacks: int("assignedPacks").notNull(),
  deliveredPacks: int("deliveredPacks").default(0).notNull(),
  returnedPacks: int("returnedPacks").default(0).notNull(),
});

export const cashMovements = mysqlTable(
  "cashMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    kind: mysqlEnum("kind", [
      "capital_contribution",
      "supplier_payment",
      "sale_collection",
      "expense",
      "customer_refund",
      "operator_remittance",
      "withdrawal",
      "profit_distribution",
      "other",
      "transfer",
    ]).notNull(),
    direction: mysqlEnum("direction", ["in", "out"]).notNull(),
    location: mysqlEnum("location", [
      "owner",
      "operator",
      "business_account",
    ]).notNull(),
    holderUserId: int("holderUserId").references(() => users.id),
    deliveryId: int("deliveryId").references(() => deliveries.id),
    amountCents: bigint("amountCents", { mode: "number" }).notNull(),
    method: mysqlEnum("method", [
      "cash",
      "bank_transfer",
      "e_wallet",
      "check",
      "other",
    ])
      .default("cash")
      .notNull(),
    sourceType: varchar("sourceType", { length: 40 }),
    sourceId: int("sourceId"),
    transferGroupId: varchar("transferGroupId", { length: 80 }),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    reference: varchar("reference", { length: 180 }),
    note: text("note"),
    occurredAt: timestamp("occurredAt").notNull(),
    actorId: int("actorId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cash_movements_idempotency_unique").on(table.idempotencyKey),
    index("cash_movements_location_date_idx").on(
      table.location,
      table.occurredAt
    ),
    index("cash_movements_delivery_idx").on(table.deliveryId),
  ]
);

export const expenses = mysqlTable(
  "expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    description: varchar("description", { length: 240 }).notNull(),
    invoiceAmountCents: bigint("invoiceAmountCents", {
      mode: "number",
    }).notNull(),
    amountCents: bigint("amountCents", { mode: "number" }).notNull(),
    cashPaidCents: bigint("cashPaidCents", { mode: "number" })
      .default(0)
      .notNull(),
    expenseDate: timestamp("expenseDate").notNull(),
    status: mysqlEnum("status", ["paid", "unpaid"]).default("unpaid").notNull(),
    costType: mysqlEnum("costType", ["purchase", "operations"])
      .default("operations")
      .notNull(),
    purchaseId: int("purchaseId").references(() => purchases.id),
    deliveryId: int("deliveryId").references(() => deliveries.id),
    receiptRef: varchar("receiptRef", { length: 180 }),
    sharedVehicle: boolean("sharedVehicle").default(false).notNull(),
    allocationBps: int("allocationBps").default(10000).notNull(),
    allocationBasis: varchar("allocationBasis", { length: 180 }),
    externalAllocationRef: varchar("externalAllocationRef", { length: 180 }),
    paidFrom: mysqlEnum("paidFrom", ["owner", "operator", "business_account"]),
    notes: text("notes"),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("expenses_idempotency_unique").on(table.idempotencyKey)]
);

export const expenseAdjustments = mysqlTable(
  "expenseAdjustments",
  {
    id: int("id").autoincrement().primaryKey(),
    expenseId: int("expenseId")
      .notNull()
      .references(() => expenses.id),
    deltaCents: bigint("deltaCents", { mode: "number" }).notNull(),
    previousAmountCents: bigint("previousAmountCents", {
      mode: "number",
    }).notNull(),
    newAmountCents: bigint("newAmountCents", { mode: "number" }).notNull(),
    reference: varchar("reference", { length: 180 }).notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    adjustedAt: timestamp("adjustedAt").notNull(),
    adjustedBy: int("adjustedBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("expense_adjustments_idempotency_unique").on(
      table.idempotencyKey
    ),
    index("expense_adjustments_expense_idx").on(
      table.expenseId,
      table.adjustedAt
    ),
  ]
);

export const investors = mysqlTable(
  "investors",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    active: boolean("active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("investors_name_unique").on(table.name)]
);

export const ownershipRecords = mysqlTable(
  "ownershipRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    investorId: int("investorId")
      .notNull()
      .references(() => investors.id),
    percentageBps: int("percentageBps").notNull(),
    effectiveDate: date("effectiveDate").notNull(),
    agreementReference: varchar("agreementReference", { length: 180 }),
    authorizedBy: int("authorizedBy")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("ownership_investor_date_unique").on(
      table.investorId,
      table.effectiveDate
    ),
    index("ownership_investor_date_idx").on(
      table.investorId,
      table.effectiveDate
    ),
  ]
);

export const capitalTransactions = mysqlTable(
  "capitalTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    kind: mysqlEnum("kind", [
      "contribution",
      "withdrawal",
      "distribution",
    ]).notNull(),
    investorId: int("investorId").references(() => investors.id),
    amountCents: bigint("amountCents", { mode: "number" }).notNull(),
    cashLocation: mysqlEnum("cashLocation", [
      "owner",
      "operator",
      "business_account",
    ]).notNull(),
    happenedAt: timestamp("happenedAt").notNull(),
    reference: varchar("reference", { length: 180 }),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    notes: text("notes"),
    authorizedBy: int("authorizedBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("capital_idempotency_unique").on(table.idempotencyKey),
    index("capital_date_idx").on(table.happenedAt),
  ]
);

export const businessSettings = mysqlTable("businessSettings", {
  id: int("id").autoincrement().primaryKey(),
  initialBudgetCents: bigint("initialBudgetCents", { mode: "number" })
    .default(2500000)
    .notNull(),
  initialInvestorName: varchar("initialInvestorName", { length: 180 })
    .default("Gale")
    .notNull(),
  turnoverTargetDays: int("turnoverTargetDays").default(7).notNull(),
  purchasingLocation: varchar("purchasingLocation", { length: 180 })
    .default("Divisoria, Philippines")
    .notNull(),
  updatedBy: int("updatedBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const cashReconciliations = mysqlTable(
  "cashReconciliations",
  {
    id: int("id").autoincrement().primaryKey(),
    idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull(),
    location: mysqlEnum("location", [
      "owner",
      "operator",
      "business_account",
    ]).notNull(),
    holderUserId: int("holderUserId").references(() => users.id),
    expectedCents: bigint("expectedCents", { mode: "number" }).notNull(),
    countedCents: bigint("countedCents", { mode: "number" }).notNull(),
    differenceCents: bigint("differenceCents", { mode: "number" }).notNull(),
    notes: text("notes"),
    countedBy: int("countedBy")
      .notNull()
      .references(() => users.id),
    countedAt: timestamp("countedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("cash_reconciliation_idempotency_unique").on(
      table.idempotencyKey
    ),
    index("cash_reconciliation_date_idx").on(table.location, table.countedAt),
  ]
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").references(() => users.id),
    action: varchar("action", { length: 80 }).notNull(),
    recordType: varchar("recordType", { length: 80 }).notNull(),
    recordId: int("recordId"),
    details: text("details"),
    happenedAt: timestamp("happenedAt").defaultNow().notNull(),
  },
  table => [
    index("audit_date_idx").on(table.happenedAt),
    index("audit_actor_idx").on(table.actorId),
  ]
);
