import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  allocateByValue,
  cashDifferenceCents,
  customerBalanceCents,
  deliveryShortagePacks,
  expenseAdjustmentAmountCents,
  lineTotalCents,
  percentageBps,
  reinvestmentCapacityCents,
  remainingPackBalance,
  remittanceOutstandingCents,
  roundRatio,
  weightedAverageCostCents,
} from "../shared/finance";
import {
  auditLogs,
  businessSettings,
  capitalTransactions,
  cashMovements,
  cashReconciliations,
  collections,
  customers,
  deliveries,
  deliveryLines,
  expenseAdjustments,
  expenses,
  inventoryMovements,
  investors,
  ownershipRecords,
  products,
  purchaseLines,
  purchases,
  saleLines,
  sales,
  salesReturns,
  supplierPayments,
  suppliers,
  users,
} from "../drizzle/schema";
import {
  appendCashMovement,
  cashBalance,
  makeCode,
  requireDatabase,
  saleBalance,
  stockOnHand,
  writeAudit,
} from "./businessHelpers";
import { getDb } from "./db";
import { operatorProcedure, ownerProcedure, router } from "./_core/trpc";

const id = z.number().int().positive();
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const signedCents = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const method = z.enum(["cash", "bank_transfer", "e_wallet", "check", "other"]);
const location = z.enum(["owner", "operator", "business_account"]);
const dateInput = z.coerce.date();
const idempotencyKey = z.string().min(8).max(60);
const optionalText = (max = 2000) =>
  z.string().trim().max(max).optional().nullable();
const toMap = <T extends { id: number }>(rows: T[]) =>
  new Map(rows.map(row => [row.id, row]));
const sum = <T>(rows: T[], value: (row: T) => number) =>
  rows.reduce((total, row) => total + Number(value(row) || 0), 0);
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const today = () => startOfDay(new Date());

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}
function isOwner(role: string) {
  return role === "owner";
}
function checkOperatorCash(
  role: string,
  userId: number,
  cashLocation: string,
  holderUserId?: number | null
) {
  if (
    role === "operator" &&
    (cashLocation !== "operator" ||
      (holderUserId != null && holderUserId !== userId))
  )
    badRequest(
      "Operators may record only cash they hold for the candy business."
    );
}
async function resolveCashHolder(
  q: any,
  role: string,
  userId: number,
  cashLocation: "owner" | "operator" | "business_account",
  requested?: number | null
) {
  if (cashLocation !== "operator") return null;
  const holderUserId = role === "operator" ? userId : (requested ?? null);
  if (holderUserId == null)
    badRequest(
      "Select the authorized operator who physically holds this cash."
    );
  if (role === "operator" && holderUserId !== userId)
    badRequest("Operators may record only cash they personally hold.");
  const [holder] = await q
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, holderUserId), eq(users.role, "operator")))
    .limit(1);
  if (!holder)
    badRequest("Cash holder must be an authorized operator account.");
  return holderUserId;
}
async function checkAvailableCash(
  tx: any,
  loc: "owner" | "operator" | "business_account",
  amountCents: number,
  holderUserId: number | null = null
) {
  // Lock current ledger rows before reading the balance so concurrent payouts cannot overspend it.
  await tx
    .select({ id: cashMovements.id })
    .from(cashMovements)
    .where(eq(cashMovements.location, loc))
    .for("update");
  const available = await cashBalance(tx, loc, holderUserId);
  if (available < amountCents)
    badRequest(
      `Insufficient recorded cash in ${loc === "business_account" ? "business accounts" : `${loc}-held cash`}. Record the actual incoming contribution or collection first.`
    );
}
async function sumColumn(
  q: any,
  table: any,
  column: any,
  where: any
): Promise<number> {
  const [row] = await q
    .select({ value: sql<number>`coalesce(sum(${column}), 0)` })
    .from(table)
    .where(where);
  return Number(row?.value ?? 0);
}

async function receivePurchase(tx: any, purchaseId: number, actorId: number) {
  const [purchase] = await tx
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .for("update")
    .limit(1);
  if (!purchase) notFound("Purchase not found.");
  if (purchase.status !== "draft")
    badRequest("Only an unreceived purchase can add stock.");
  const lines = await tx
    .select()
    .from(purchaseLines)
    .where(eq(purchaseLines.purchaseId, purchaseId));
  if (!lines.length)
    badRequest("A purchase must contain at least one product line.");
  const directCosts = await tx
    .select({ amount: expenses.amountCents })
    .from(expenses)
    .where(
      and(
        eq(expenses.purchaseId, purchaseId),
        eq(expenses.costType, "purchase")
      )
    );
  const acquisitionCosts =
    Number(purchase.acquisitionCostsCents) +
    directCosts.reduce(
      (total: number, row: any) => total + Number(row.amount),
      0
    );
  if (
    !Number.isSafeInteger(acquisitionCosts) ||
    !Number.isSafeInteger(Number(purchase.subtotalCents) + acquisitionCosts)
  )
    badRequest("Landed purchase cost exceeds the supported currency range.");
  const allocations = allocateByValue(
    acquisitionCosts,
    lines.map((line: any) => Number(line.lineSubtotalCents))
  );
  const now = new Date();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, line.productId))
      .for("update")
      .limit(1);
    if (!product) notFound(`Product ${line.productId} no longer exists.`);
    const currentPacks = await stockOnHand(tx, product.id);
    const landedLineCents =
      Number(line.lineSubtotalCents) + Number(allocations[i] ?? 0);
    const landedUnitCostCents = Math.round(landedLineCents / line.packs);
    const averageCostCents = weightedAverageCostCents(
      currentPacks,
      Number(product.averageCostCents),
      line.packs,
      landedLineCents
    );
    await tx
      .update(products)
      .set({ averageCostCents })
      .where(eq(products.id, product.id));
    await tx
      .update(purchaseLines)
      .set({
        allocatedCostCents: Number(allocations[i] ?? 0),
        landedLineCents,
        landedUnitCostCents,
      })
      .where(eq(purchaseLines.id, line.id));
    await tx.insert(inventoryMovements).values({
      productId: product.id,
      kind: "receipt",
      quantityDelta: line.packs,
      unitCostCents: landedUnitCostCents,
      costValueCents: landedLineCents,
      sourceType: "purchase",
      sourceId: purchaseId,
      idempotencyKey: `purchase:${purchaseId}:line:${line.id}:receipt`,
      notes: `Receipt ${purchase.purchaseNo}`,
      actorId,
      movedAt: now,
    });
  }
  await tx
    .update(purchases)
    .set({
      status: "received",
      receivedAt: now,
      landedCostCents: Number(purchase.subtotalCents) + acquisitionCosts,
    })
    .where(eq(purchases.id, purchaseId));
  await writeAudit(tx, actorId, "receive", "purchase", purchaseId, {
    receivedLineCount: lines.length,
    acquisitionCostsCents: acquisitionCosts,
  });
}

async function recordSaleReturn(
  tx: any,
  input: {
    saleId: number;
    saleLineId: number;
    packs: number;
    restockable: boolean;
    reason: string;
    idempotencyKey: string;
    actorId: number;
    returnedAt: Date;
  }
) {
  const [duplicate] = await tx
    .select()
    .from(salesReturns)
    .where(eq(salesReturns.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (duplicate) {
    if (
      duplicate.saleId !== input.saleId ||
      duplicate.saleLineId !== input.saleLineId ||
      duplicate.packs !== input.packs ||
      duplicate.restockable !== input.restockable ||
      duplicate.reason !== input.reason ||
      duplicate.createdBy !== input.actorId
    )
      badRequest("This idempotency key is already used by another return.");
    return duplicate;
  }
  const [line] = await tx
    .select()
    .from(saleLines)
    .where(
      and(
        eq(saleLines.id, input.saleLineId),
        eq(saleLines.saleId, input.saleId)
      )
    )
    .for("update")
    .limit(1);
  if (!line) notFound("Sale line not found.");
  const [duplicateAfterLock] = await tx
    .select()
    .from(salesReturns)
    .where(eq(salesReturns.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (duplicateAfterLock) {
    if (
      duplicateAfterLock.saleId !== input.saleId ||
      duplicateAfterLock.saleLineId !== input.saleLineId ||
      duplicateAfterLock.packs !== input.packs ||
      duplicateAfterLock.restockable !== input.restockable ||
      duplicateAfterLock.reason !== input.reason ||
      duplicateAfterLock.createdBy !== input.actorId
    )
      badRequest("This idempotency key is already used by another return.");
    return duplicateAfterLock;
  }
  const returnedBefore = await sumColumn(
    tx,
    salesReturns,
    salesReturns.packs,
    eq(salesReturns.saleLineId, line.id)
  );
  if (input.packs <= 0 || returnedBefore + input.packs > line.packs)
    badRequest(
      "Returned packs cannot exceed the quantity sold and not already returned."
    );
  const creditCents = roundRatio(
    Number(line.lineTotalCents),
    input.packs,
    line.packs
  );
  const [product] = await tx
    .select()
    .from(products)
    .where(eq(products.id, line.productId))
    .for("update")
    .limit(1);
  if (!product) notFound("Product for this sale no longer exists.");
  const [ret] = await tx.insert(salesReturns).values({
    idempotencyKey: input.idempotencyKey,
    saleId: input.saleId,
    saleLineId: line.id,
    productId: line.productId,
    packs: input.packs,
    creditCents,
    restockable: input.restockable,
    reason: input.reason,
    returnedAt: input.returnedAt,
    createdBy: input.actorId,
  });
  const createdId = Number(ret.insertId);
  if (input.restockable) {
    const stock = await stockOnHand(tx, line.productId);
    const restoredValue = Number(line.unitCostCents) * input.packs;
    if (!Number.isSafeInteger(restoredValue))
      badRequest("Returned inventory cost exceeds the supported range.");
    const newAverage = weightedAverageCostCents(
      stock,
      Number(product.averageCostCents),
      input.packs,
      restoredValue
    );
    await tx
      .update(products)
      .set({ averageCostCents: newAverage })
      .where(eq(products.id, line.productId));
    await tx.insert(inventoryMovements).values({
      productId: line.productId,
      kind: "customer_return",
      quantityDelta: input.packs,
      unitCostCents: Number(line.unitCostCents),
      costValueCents: restoredValue,
      sourceType: "sales_return",
      sourceId: createdId,
      idempotencyKey: `return:${input.idempotencyKey}:inventory`,
      notes: input.reason,
      actorId: input.actorId,
      movedAt: input.returnedAt,
    });
  } else {
    await tx.insert(inventoryMovements).values({
      productId: line.productId,
      kind: "customer_return",
      quantityDelta: 0,
      unitCostCents: Number(line.unitCostCents),
      costValueCents: 0,
      sourceType: "sales_return",
      sourceId: createdId,
      idempotencyKey: `return:${input.idempotencyKey}:inventory`,
      notes: `${input.reason} — not restocked`,
      actorId: input.actorId,
      movedAt: input.returnedAt,
    });
  }
  await writeAudit(tx, input.actorId, "return", "sale", input.saleId, {
    returnId: createdId,
    saleLineId: line.id,
    packs: input.packs,
    creditCents,
    restockable: input.restockable,
  });
  return {
    id: createdId,
    saleId: input.saleId,
    saleLineId: line.id,
    packs: input.packs,
    creditCents,
    restockable: input.restockable,
  };
}

async function createCollection(
  tx: any,
  input: {
    saleId: number;
    deliveryId?: number | null;
    kind: "collection" | "refund";
    amountCents: number;
    method: "cash" | "bank_transfer" | "e_wallet" | "check" | "other";
    cashLocation: "owner" | "operator" | "business_account";
    holderUserId?: number | null;
    reference?: string | null;
    idempotencyKey: string;
    collectedAt: Date;
    collectedBy: number;
  }
) {
  const [duplicate] = await tx
    .select()
    .from(collections)
    .where(eq(collections.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (duplicate) return duplicate;
  const [sale] = await tx
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.id, input.saleId))
    .for("update")
    .limit(1);
  if (!sale) notFound("Sale not found.");
  const balance = await saleBalance(tx, input.saleId);
  if (input.amountCents <= 0)
    badRequest("Enter a collection/refund amount greater than zero.");
  if (input.kind === "collection" && input.amountCents > balance.balanceCents)
    badRequest("Collection exceeds the customer's outstanding receivable.");
  if (
    input.kind === "refund" &&
    input.amountCents > balance.creditedReturnsCents - balance.refundsCents
  )
    badRequest("Refund exceeds the unrefunded customer-return credit.");
  if (input.kind === "refund")
    await checkAvailableCash(
      tx,
      input.cashLocation,
      input.amountCents,
      input.cashLocation === "operator"
        ? (input.holderUserId ?? input.collectedBy)
        : null
    );
  const [result] = await tx.insert(collections).values({
    saleId: input.saleId,
    deliveryId: input.deliveryId ?? null,
    kind: input.kind,
    amountCents: input.amountCents,
    method: input.method,
    cashLocation: input.cashLocation,
    reference: input.reference ?? null,
    idempotencyKey: input.idempotencyKey,
    collectedAt: input.collectedAt,
    collectedBy: input.collectedBy,
  });
  const collectionId = Number(result.insertId);
  const holder =
    input.cashLocation === "operator"
      ? (input.holderUserId ?? input.collectedBy)
      : null;
  await appendCashMovement(tx, {
    kind: input.kind === "refund" ? "customer_refund" : "sale_collection",
    direction: input.kind === "refund" ? "out" : "in",
    location: input.cashLocation,
    holderUserId: holder,
    deliveryId: input.deliveryId,
    amountCents: input.amountCents,
    method: input.method,
    sourceType: "collection",
    sourceId: collectionId,
    idempotencyKey: `collection:${input.idempotencyKey}:cash`,
    reference: input.reference,
    actorId: input.collectedBy,
    occurredAt: input.collectedAt,
  });
  await writeAudit(
    tx,
    input.collectedBy,
    input.kind,
    "collection",
    collectionId,
    {
      saleId: input.saleId,
      amountCents: input.amountCents,
      cashLocation: input.cashLocation,
    }
  );
  return {
    id: collectionId,
    saleId: input.saleId,
    amountCents: input.amountCents,
    kind: input.kind,
  };
}

export const businessRouter = router({
  access: router({
    me: operatorProcedure.query(({ ctx }) => ({
      ...ctx.user,
      role: ctx.user.role,
    })),
    pending: ownerProcedure.query(async () => {
      const db = requireDatabase(await getDb());
      return db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .orderBy(desc(users.createdAt));
    }),
    setOperator: ownerProcedure
      .input(z.object({ userId: id, enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id)
          badRequest("You cannot change your own owner access here.");
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [target] = await tx
            .select()
            .from(users)
            .where(eq(users.id, input.userId))
            .for("update")
            .limit(1);
          if (!target) notFound("Account not found.");
          if (target.role === "owner")
            badRequest(
              "Owner accounts cannot be changed through operator access controls."
            );
          await tx
            .update(users)
            .set({ role: input.enabled ? "operator" : "pending" })
            .where(eq(users.id, input.userId));
          await writeAudit(
            tx,
            ctx.user.id,
            input.enabled ? "authorize_operator" : "revoke_operator",
            "user",
            input.userId
          );
          return { success: true };
        });
      }),
  }),

  products: router({
    list: operatorProcedure
      .input(
        z
          .object({
            search: z.string().trim().max(100).optional(),
            activeOnly: z.boolean().default(false),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const filters: any[] = [];
        if (input?.activeOnly) filters.push(eq(products.active, true));
        if (input?.search)
          filters.push(
            or(
              like(products.name, `%${input.search}%`),
              like(products.sku, `%${input.search}%`),
              like(products.variety, `%${input.search}%`)
            )
          );
        const rows = await db
          .select()
          .from(products)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(asc(products.name));
        const movements = await db
          .select({
            productId: inventoryMovements.productId,
            packs: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`,
          })
          .from(inventoryMovements)
          .groupBy(inventoryMovements.productId);
        const stock = new Map(
          movements.map(row => [row.productId, Number(row.packs)])
        );
        const owner = isOwner(ctx.user.role);
        return rows.map(p => ({
          ...p,
          stockPacks: stock.get(p.id) ?? 0,
          averageCostCents: owner ? p.averageCostCents : null,
          inventoryValueCents: owner
            ? (stock.get(p.id) ?? 0) * Number(p.averageCostCents)
            : null,
        }));
      }),
    create: ownerProcedure
      .input(
        z.object({
          sku: z.string().trim().min(1).max(64),
          name: z.string().trim().min(1).max(180),
          variety: optionalText(180),
          packDescription: z.string().trim().min(1).max(180),
          piecesPerPack: z.number().int().positive().optional().nullable(),
          defaultPriceCents: cents,
          reorderPacks: z.number().int().nonnegative().max(100000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [result] = await tx
            .insert(products)
            .values({ ...input, variety: input.variety || null, active: true });
          const productId = Number(result.insertId);
          await writeAudit(tx, ctx.user.id, "create", "product", productId, {
            sku: input.sku,
            name: input.name,
          });
          return { id: productId };
        });
      }),
    update: ownerProcedure
      .input(
        z.object({
          id,
          sku: z.string().trim().min(1).max(64),
          name: z.string().trim().min(1).max(180),
          variety: optionalText(180),
          packDescription: z.string().trim().min(1).max(180),
          piecesPerPack: z.number().int().positive().optional().nullable(),
          defaultPriceCents: cents,
          reorderPacks: z.number().int().nonnegative().max(100000),
          active: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const { id: productId, ...values } = input;
        await db
          .update(products)
          .set({ ...values, variety: values.variety || null })
          .where(eq(products.id, productId));
        await writeAudit(db, ctx.user.id, "update", "product", productId, {
          sku: input.sku,
          active: input.active,
        });
        return { success: true };
      }),
  }),

  customers: router({
    list: operatorProcedure
      .input(
        z.object({ search: z.string().trim().max(100).optional() }).optional()
      )
      .query(async ({ input }) => {
        const db = requireDatabase(await getDb());
        const where = input?.search
          ? or(
              like(customers.storeName, `%${input.search}%`),
              like(customers.contactName, `%${input.search}%`),
              like(customers.address, `%${input.search}%`)
            )
          : undefined;
        return db
          .select()
          .from(customers)
          .where(where)
          .orderBy(asc(customers.storeName))
          .limit(500);
      }),
    create: operatorProcedure
      .input(
        z.object({
          storeName: z.string().trim().min(1).max(180),
          contactName: optionalText(180),
          contact: optionalText(180),
          address: optionalText(2000),
          notes: optionalText(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const [result] = await db
          .insert(customers)
          .values({
            ...input,
            contactName: input.contactName || null,
            contact: input.contact || null,
            address: input.address || null,
            notes: input.notes || null,
          });
        const customerId = Number(result.insertId);
        await writeAudit(db, ctx.user.id, "create", "customer", customerId, {
          storeName: input.storeName,
        });
        return { id: customerId };
      }),
  }),

  suppliers: router({
    list: operatorProcedure.query(async () => {
      const db = requireDatabase(await getDb());
      return db
        .select()
        .from(suppliers)
        .where(eq(suppliers.active, true))
        .orderBy(asc(suppliers.name))
        .limit(300);
    }),
    create: operatorProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(180),
          contact: optionalText(180),
          address: optionalText(2000),
          notes: optionalText(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const [result] = await db
          .insert(suppliers)
          .values({
            ...input,
            contact: input.contact || null,
            address: input.address || null,
            notes: input.notes || null,
          });
        const supplierId = Number(result.insertId);
        await writeAudit(db, ctx.user.id, "create", "supplier", supplierId, {
          name: input.name,
        });
        return { id: supplierId };
      }),
  }),

  purchases: router({
    list: operatorProcedure
      .input(
        z
          .object({
            from: dateInput.optional(),
            to: dateInput.optional(),
            search: z.string().trim().max(100).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const filters: any[] = [];
        if (input?.from) filters.push(gte(purchases.purchaseDate, input.from));
        if (input?.to) filters.push(lte(purchases.purchaseDate, input.to));
        if (input?.search)
          filters.push(
            or(
              like(purchases.purchaseNo, `%${input.search}%`),
              like(purchases.supplierName, `%${input.search}%`)
            )
          );
        if (ctx.user.role === "operator")
          filters.push(
            or(
              eq(purchases.operatorId, ctx.user.id),
              eq(purchases.createdBy, ctx.user.id)
            )
          );
        const rows = await db
          .select()
          .from(purchases)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(purchases.purchaseDate))
          .limit(250);
        return Promise.all(
          rows.map(async p => {
            const lines = await db
              .select()
              .from(purchaseLines)
              .where(eq(purchaseLines.purchaseId, p.id));
            if (ctx.user.role === "operator") {
              const {
                subtotalCents,
                acquisitionCostsCents,
                landedCostCents,
                ...safePurchase
              } = p;
              return {
                ...safePurchase,
                lines: lines.map(
                  ({
                    unitCostCents,
                    lineSubtotalCents,
                    allocatedCostCents,
                    landedLineCents,
                    landedUnitCostCents,
                    ...safeLine
                  }) => safeLine
                ),
              };
            }
            const pays = await db
              .select()
              .from(supplierPayments)
              .where(eq(supplierPayments.purchaseId, p.id));
            const directCosts = await db
              .select()
              .from(expenses)
              .where(
                and(
                  eq(expenses.purchaseId, p.id),
                  eq(expenses.costType, "purchase")
                )
              );
            const paidCents = sum(pays, x => x.amountCents);
            const directTotal = sum(
              directCosts,
              expense => expense.amountCents
            );
            const directPaid = sum(
              directCosts,
              expense => expense.cashPaidCents
            );
            const balanceCents = Math.max(
              0,
              Number(p.subtotalCents) +
                Number(p.acquisitionCostsCents) -
                paidCents +
                directTotal -
                directPaid
            );
            const totalPayableCents =
              Number(p.subtotalCents) +
              Number(p.acquisitionCostsCents) +
              directTotal;
            return {
              ...p,
              lines,
              paidCents,
              directCostCents: directTotal,
              directCostPaidCents: directPaid,
              balanceCents,
              paymentStatus:
                totalPayableCents === balanceCents
                  ? "unpaid"
                  : balanceCents === 0
                    ? "paid"
                    : "partial",
            };
          })
        );
      }),
    create: operatorProcedure
      .input(
        z.object({
          idempotencyKey,
          supplierId: id.optional(),
          supplierName: z.string().trim().min(1).max(180),
          sourceLocation: optionalText(180),
          operatorId: id.optional(),
          purchaseDate: dateInput,
          acquisitionCostsCents: cents.default(0),
          receiptRef: optionalText(180),
          notes: optionalText(),
          receiveNow: z.boolean(),
          paidNowCents: cents.default(0),
          paymentMethod: method.default("cash"),
          cashLocation: location.optional(),
          lines: z
            .array(
              z.object({
                productId: id,
                packs: z.number().int().positive().max(100000),
                unitCostCents: cents,
              })
            )
            .min(1)
            .max(100),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const duplicate = await db
          .select()
          .from(purchases)
          .where(eq(purchases.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (duplicate[0])
          return {
            id: duplicate[0].id,
            purchaseNo: duplicate[0].purchaseNo,
            duplicate: true,
          };
        if (
          ctx.user.role === "operator" &&
          (input.receiveNow ||
            input.paidNowCents > 0 ||
            (input.operatorId != null && input.operatorId !== ctx.user.id))
        )
          badRequest(
            "Operator-sourced purchase entries are proposals only. The owner must approve and assign them before receipt or payment."
          );
        if (
          new Set(input.lines.map(x => x.productId)).size !== input.lines.length
        )
          badRequest("Use one line per product in a purchase.");
        const subtotalCents = input.lines.reduce(
          (total, line) => total + line.packs * line.unitCostCents,
          0
        );
        if (!Number.isSafeInteger(subtotalCents))
          badRequest("Purchase total exceeds the supported range.");
        const assignedOperatorId =
          ctx.user.role === "operator" ? ctx.user.id : input.operatorId;
        if (assignedOperatorId) {
          const [operator] = await db
            .select()
            .from(users)
            .where(eq(users.id, assignedOperatorId))
            .limit(1);
          if (!operator || operator.role !== "operator")
            badRequest("Assign the purchase only to an authorized operator.");
        }
        const allocations = allocateByValue(
          input.acquisitionCostsCents,
          input.lines.map(line => line.packs * line.unitCostCents)
        );
        const cashLocation =
          ctx.user.role === "operator"
            ? "operator"
            : (input.cashLocation ?? "owner");
        checkOperatorCash(ctx.user.role, ctx.user.id, cashLocation);
        const cashHolderUserId = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          cashLocation,
          assignedOperatorId
        );
        if (input.paidNowCents > subtotalCents + input.acquisitionCostsCents)
          badRequest("Initial supplier payment exceeds purchase amount.");
        if (input.paidNowCents > 0)
          await checkAvailableCash(
            db,
            cashLocation,
            input.paidNowCents,
            cashHolderUserId
          );
        const [settings] = await db.select().from(businessSettings).limit(1);
        const sourceLocation =
          input.sourceLocation?.trim() ||
          settings?.purchasingLocation ||
          "Divisoria, Philippines";
        const purchaseNo = makeCode("PUR");
        return db.transaction(async tx => {
          const existing = await tx
            .select()
            .from(purchases)
            .where(eq(purchases.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (existing[0])
            return {
              id: existing[0].id,
              purchaseNo: existing[0].purchaseNo,
              duplicate: true,
            };
          for (const line of input.lines) {
            const [product] = await tx
              .select()
              .from(products)
              .where(eq(products.id, line.productId))
              .for("update")
              .limit(1);
            if (!product || !product.active)
              badRequest("A selected product is inactive or unavailable.");
          }
          const landedCostCents = subtotalCents + input.acquisitionCostsCents;
          if (!Number.isSafeInteger(landedCostCents))
            badRequest(
              "Landed purchase cost exceeds the supported currency range."
            );
          const [inserted] = await tx.insert(purchases).values({
            purchaseNo,
            idempotencyKey: input.idempotencyKey,
            supplierId: input.supplierId ?? null,
            supplierName: input.supplierName,
            purchaseDate: input.purchaseDate,
            sourceLocation,
            subtotalCents,
            acquisitionCostsCents: input.acquisitionCostsCents,
            landedCostCents,
            status: "draft",
            receiptRef: input.receiptRef || null,
            notes: input.notes || null,
            operatorId: assignedOperatorId ?? null,
            createdBy: ctx.user.id,
            ownerApprovedAt: isOwner(ctx.user.role) ? new Date() : null,
            ownerApprovedBy: isOwner(ctx.user.role) ? ctx.user.id : null,
          });
          const purchaseId = Number(inserted.insertId);
          const values = input.lines.map((line, index) => {
            const lineSubtotalCents = line.packs * line.unitCostCents;
            const allocatedCostCents = Number(allocations[index] ?? 0);
            const landedLineCents = lineSubtotalCents + allocatedCostCents;
            return {
              purchaseId,
              productId: line.productId,
              packs: line.packs,
              unitCostCents: line.unitCostCents,
              lineSubtotalCents,
              allocatedCostCents,
              landedLineCents,
              landedUnitCostCents: Math.round(landedLineCents / line.packs),
            };
          });
          await tx.insert(purchaseLines).values(values);
          if (input.receiveNow)
            await receivePurchase(tx, purchaseId, ctx.user.id);
          if (input.paidNowCents > 0) {
            await checkAvailableCash(
              tx,
              cashLocation,
              input.paidNowCents,
              cashHolderUserId
            );
            const paidAt = new Date();
            await tx
              .insert(supplierPayments)
              .values({
                purchaseId,
                amountCents: input.paidNowCents,
                method: input.paymentMethod,
                cashLocation,
                reference: null,
                idempotencyKey: `${input.idempotencyKey}:payment`,
                paidAt,
                paidBy: ctx.user.id,
              });
            await appendCashMovement(tx, {
              kind: "supplier_payment",
              direction: "out",
              location: cashLocation,
              holderUserId: cashHolderUserId,
              amountCents: input.paidNowCents,
              method: input.paymentMethod,
              sourceType: "purchase_payment",
              sourceId: purchaseId,
              idempotencyKey: `${input.idempotencyKey}:cash`,
              actorId: ctx.user.id,
              occurredAt: paidAt,
            });
          }
          await writeAudit(
            tx,
            ctx.user.id,
            isOwner(ctx.user.role) ? "create_purchase" : "propose_purchase",
            "purchase",
            purchaseId,
            {
              purchaseNo,
              sourceLocation,
              status: input.receiveNow ? "received" : "draft",
              subtotalCents,
              landedCostCents,
            }
          );
          return { id: purchaseId, purchaseNo, duplicate: false };
        });
      }),
    approve: ownerProcedure
      .input(z.object({ purchaseId: id, operatorId: id }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [purchase] = await tx
            .select()
            .from(purchases)
            .where(eq(purchases.id, input.purchaseId))
            .for("update")
            .limit(1);
          if (!purchase) notFound("Purchase not found.");
          if (purchase.status !== "draft")
            badRequest("Only a draft purchase can be approved for receipt.");
          const [operator] = await tx
            .select()
            .from(users)
            .where(eq(users.id, input.operatorId))
            .limit(1);
          if (!operator || operator.role !== "operator")
            badRequest("Assign the purchase only to an authorized operator.");
          await tx
            .update(purchases)
            .set({
              operatorId: input.operatorId,
              ownerApprovedAt: new Date(),
              ownerApprovedBy: ctx.user.id,
            })
            .where(eq(purchases.id, purchase.id));
          await writeAudit(
            tx,
            ctx.user.id,
            "approve_and_assign_purchase",
            "purchase",
            purchase.id,
            { operatorId: input.operatorId }
          );
          return { success: true };
        });
      }),
    receive: operatorProcedure
      .input(z.object({ purchaseId: id }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [purchase] = await tx
            .select()
            .from(purchases)
            .where(eq(purchases.id, input.purchaseId))
            .for("update")
            .limit(1);
          if (!purchase) notFound("Purchase not found.");
          if (
            ctx.user.role === "operator" &&
            (purchase.operatorId !== ctx.user.id || !purchase.ownerApprovedAt)
          )
            badRequest(
              "This purchase must be owner-approved and assigned to your account before receipt."
            );
          await receivePurchase(tx, input.purchaseId, ctx.user.id);
          return { success: true };
        });
      }),
    pay: ownerProcedure
      .input(
        z.object({
          purchaseId: id,
          amountCents: cents.refine(n => n > 0),
          method,
          cashLocation: location.optional(),
          holderUserId: id.optional(),
          reference: optionalText(180),
          idempotencyKey,
          paidAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const loc =
          ctx.user.role === "operator"
            ? "operator"
            : (input.cashLocation ?? "owner");
        checkOperatorCash(ctx.user.role, ctx.user.id, loc);
        const cashHolderUserId = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          loc,
          input.holderUserId
        );
        const [purchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, input.purchaseId))
          .limit(1);
        if (!purchase) notFound("Purchase not found.");
        if (purchase.status === "cancelled")
          badRequest("A cancelled purchase cannot be paid.");
        if (
          ctx.user.role === "operator" &&
          (purchase.operatorId !== ctx.user.id || !purchase.ownerApprovedAt)
        )
          badRequest(
            "This purchase must be owner-approved and assigned to your account before payment."
          );
        const duplicate = await db
          .select()
          .from(supplierPayments)
          .where(eq(supplierPayments.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (duplicate[0]) return { id: duplicate[0].id, duplicate: true };
        const paid = await sumColumn(
          db,
          supplierPayments,
          supplierPayments.amountCents,
          eq(supplierPayments.purchaseId, input.purchaseId)
        );
        const maxDue =
          Number(purchase.subtotalCents) +
          Number(purchase.acquisitionCostsCents);
        if (paid + input.amountCents > maxDue)
          badRequest("Supplier payment exceeds the unpaid supplier balance.");
        await checkAvailableCash(db, loc, input.amountCents, cashHolderUserId);
        return db.transaction(async tx => {
          const prior = await tx
            .select()
            .from(supplierPayments)
            .where(eq(supplierPayments.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior[0]) return { id: prior[0].id, duplicate: true };
          const [lockedPurchase] = await tx
            .select()
            .from(purchases)
            .where(eq(purchases.id, input.purchaseId))
            .for("update")
            .limit(1);
          if (!lockedPurchase) notFound("Purchase not found.");
          if (lockedPurchase.status === "cancelled")
            badRequest("A cancelled purchase cannot be paid.");
          if (
            ctx.user.role === "operator" &&
            (lockedPurchase.operatorId !== ctx.user.id ||
              !lockedPurchase.ownerApprovedAt)
          )
            badRequest(
              "This purchase must be owner-approved and assigned to your account before payment."
            );
          const paidNow = await sumColumn(
            tx,
            supplierPayments,
            supplierPayments.amountCents,
            eq(supplierPayments.purchaseId, input.purchaseId)
          );
          const currentDue =
            Number(lockedPurchase.subtotalCents) +
            Number(lockedPurchase.acquisitionCostsCents) -
            paidNow;
          if (input.amountCents > currentDue)
            badRequest("Supplier payment exceeds the unpaid supplier balance.");
          await checkAvailableCash(
            tx,
            loc,
            input.amountCents,
            cashHolderUserId
          );
          const [result] = await tx
            .insert(supplierPayments)
            .values({
              purchaseId: input.purchaseId,
              amountCents: input.amountCents,
              method: input.method,
              cashLocation: loc,
              reference: input.reference || null,
              idempotencyKey: input.idempotencyKey,
              paidAt: input.paidAt,
              paidBy: ctx.user.id,
            });
          await appendCashMovement(tx, {
            kind: "supplier_payment",
            direction: "out",
            location: loc,
            holderUserId: cashHolderUserId,
            amountCents: input.amountCents,
            method: input.method,
            sourceType: "purchase_payment",
            sourceId: input.purchaseId,
            idempotencyKey: `${input.idempotencyKey}:cash`,
            reference: input.reference,
            actorId: ctx.user.id,
            occurredAt: input.paidAt,
          });
          await writeAudit(
            tx,
            ctx.user.id,
            "supplier_payment",
            "purchase",
            input.purchaseId,
            { amountCents: input.amountCents }
          );
          return { id: Number(result.insertId), duplicate: false };
        });
      }),
  }),

  sales: router({
    list: operatorProcedure
      .input(
        z
          .object({
            from: dateInput.optional(),
            to: dateInput.optional(),
            search: z.string().trim().max(100).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const filters: any[] = [eq(sales.status, "completed")];
        if (input?.from) filters.push(gte(sales.saleDate, input.from));
        if (input?.to) filters.push(lte(sales.saleDate, input.to));
        if (input?.search)
          filters.push(
            or(
              like(sales.saleNo, `%${input.search}%`),
              like(sales.storeName, `%${input.search}%`)
            )
          );
        if (ctx.user.role === "operator")
          filters.push(
            or(
              eq(sales.operatorId, ctx.user.id),
              eq(sales.createdBy, ctx.user.id)
            )
          );
        const rows = await db
          .select()
          .from(sales)
          .where(and(...filters))
          .orderBy(desc(sales.saleDate))
          .limit(300);
        const owner = isOwner(ctx.user.role);
        return Promise.all(
          rows.map(async sale => {
            const saleLinesRows = await db
              .select()
              .from(saleLines)
              .where(eq(saleLines.saleId, sale.id));
            const lines = owner
              ? saleLinesRows
              : saleLinesRows.map(
                  ({ unitCostCents, cogsCents, ...line }) => line
                );
            return { ...sale, lines, ...(await saleBalance(db, sale.id)) };
          })
        );
      }),
    create: ownerProcedure
      .input(
        z.object({
          idempotencyKey,
          customerId: id.optional(),
          storeName: z.string().trim().min(1).max(180),
          saleDate: dateInput,
          headerDiscountCents: cents.default(0),
          operatorId: id.optional(),
          notes: optionalText(),
          paidNowCents: cents.default(0),
          paymentMethod: method.default("cash"),
          cashLocation: location.optional(),
          collectionReference: optionalText(180),
          lines: z
            .array(
              z.object({
                productId: id,
                packs: z.number().int().positive().max(100000),
                unitPriceCents: cents,
                discountCents: cents.default(0),
              })
            )
            .min(1)
            .max(100),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const duplicate = await db
          .select()
          .from(sales)
          .where(eq(sales.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (duplicate[0])
          return {
            id: duplicate[0].id,
            saleNo: duplicate[0].saleNo,
            duplicate: true,
          };
        if (
          new Set(input.lines.map(x => x.productId)).size !== input.lines.length
        )
          badRequest("Use one line per product in a sale.");
        const assignedOperatorId = input.operatorId;
        if (assignedOperatorId) {
          const [operator] = await db
            .select()
            .from(users)
            .where(eq(users.id, assignedOperatorId))
            .limit(1);
          if (!operator || operator.role !== "operator")
            badRequest(
              "The assigned delivery account is not an authorized operator."
            );
        }
        const grossByLine = input.lines.map(line => {
          const gross = line.packs * line.unitPriceCents;
          if (!Number.isSafeInteger(gross))
            badRequest("A sale line exceeds the supported currency range.");
          if (line.discountCents > gross)
            badRequest("A line discount cannot exceed its gross amount.");
          return gross;
        });
        const grossCents = grossByLine.reduce(
          (total, gross) => total + gross,
          0
        );
        if (!Number.isSafeInteger(grossCents))
          badRequest("Sale total exceeds the supported currency range.");
        const lineDiscounts = input.lines.map(line => line.discountCents);
        const subtotalAfterLineDiscounts = grossByLine.map(
          (gross, i) => gross - lineDiscounts[i]!
        );
        if (
          input.headerDiscountCents >
          subtotalAfterLineDiscounts.reduce((a, b) => a + b, 0)
        )
          badRequest("Overall discount exceeds the invoice amount.");
        const allocations = allocateByValue(
          input.headerDiscountCents,
          subtotalAfterLineDiscounts
        );
        const totalDiscount =
          input.headerDiscountCents + lineDiscounts.reduce((a, b) => a + b, 0);
        const totalCents = grossCents - totalDiscount;
        if (totalCents <= 0)
          badRequest("Sale total must be greater than zero.");
        if (input.paidNowCents > totalCents)
          badRequest("Initial collection exceeds the invoice amount.");
        const loc = input.cashLocation ?? "owner";
        const initialCashHolder =
          input.paidNowCents > 0
            ? await resolveCashHolder(
                db,
                ctx.user.role,
                ctx.user.id,
                loc,
                assignedOperatorId
              )
            : null;
        const saleNo = makeCode("SAL");
        return db.transaction(async tx => {
          const existing = await tx
            .select()
            .from(sales)
            .where(eq(sales.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (existing[0])
            return {
              id: existing[0].id,
              saleNo: existing[0].saleNo,
              duplicate: true,
            };
          const productRows = new Map<number, any>();
          for (const line of input.lines) {
            const [product] = await tx
              .select()
              .from(products)
              .where(eq(products.id, line.productId))
              .for("update")
              .limit(1);
            if (!product || !product.active)
              badRequest("A selected product is inactive or unavailable.");
            const available = await stockOnHand(tx, line.productId);
            const remaining = remainingPackBalance(available, line.packs);
            if (remaining === null)
              badRequest(
                `Insufficient packs on hand for ${product.name}; available: ${available}.`
              );
            productRows.set(line.productId, { product, available, remaining });
          }
          const [inserted] = await tx.insert(sales).values({
            saleNo,
            idempotencyKey: input.idempotencyKey,
            customerId: input.customerId ?? null,
            storeName: input.storeName,
            saleDate: input.saleDate,
            grossCents,
            discountCents: totalDiscount,
            totalCents,
            status: "completed",
            deliveryStatus: assignedOperatorId ? "assigned" : "pending",
            operatorId: assignedOperatorId ?? null,
            notes: input.notes || null,
            createdBy: ctx.user.id,
          });
          const saleId = Number(inserted.insertId);
          let assignedDeliveryId: number | undefined;
          for (let i = 0; i < input.lines.length; i++) {
            const line = input.lines[i]!;
            const { product } = productRows.get(line.productId)!;
            const finalDiscount =
              lineDiscounts[i]! + Number(allocations[i] ?? 0);
            const amount = lineTotalCents(
              line.packs,
              line.unitPriceCents,
              finalDiscount
            );
            const cogsCents = Number(product.averageCostCents) * line.packs;
            if (!Number.isSafeInteger(cogsCents))
              badRequest("Sale cost exceeds the supported currency range.");
            const [lineResult] = await tx
              .insert(saleLines)
              .values({
                saleId,
                productId: product.id,
                productName: product.name,
                packs: line.packs,
                unitPriceCents: line.unitPriceCents,
                lineDiscountCents: finalDiscount,
                lineTotalCents: amount,
                unitCostCents: Number(product.averageCostCents),
                cogsCents,
              });
            await tx
              .insert(inventoryMovements)
              .values({
                productId: product.id,
                kind: "sale",
                quantityDelta: -line.packs,
                unitCostCents: Number(product.averageCostCents),
                costValueCents: cogsCents,
                sourceType: "sale",
                sourceId: saleId,
                idempotencyKey: `sale:${input.idempotencyKey}:line:${lineResult.insertId}`,
                notes: saleNo,
                actorId: ctx.user.id,
                movedAt: input.saleDate,
              });
          }
          if (assignedOperatorId) {
            const deliveryNo = makeCode("DEL");
            const [deliveryResult] = await tx
              .insert(deliveries)
              .values({
                deliveryNo,
                saleId,
                operatorId: assignedOperatorId,
                status: "assigned",
                assignedAt: new Date(),
                notes: null,
                createdBy: ctx.user.id,
              });
            const deliveryId = Number(deliveryResult.insertId);
            assignedDeliveryId = deliveryId;
            const lines = await tx
              .select()
              .from(saleLines)
              .where(eq(saleLines.saleId, saleId));
            await tx
              .insert(deliveryLines)
              .values(
                lines.map(line => ({
                  deliveryId,
                  saleLineId: line.id,
                  productId: line.productId,
                  assignedPacks: line.packs,
                  returnedPacks: 0,
                }))
              );
          }
          if (input.paidNowCents > 0)
            await createCollection(tx, {
              saleId,
              deliveryId: assignedDeliveryId,
              kind: "collection",
              amountCents: input.paidNowCents,
              method: input.paymentMethod,
              cashLocation: loc,
              holderUserId: initialCashHolder,
              reference: input.collectionReference,
              idempotencyKey: `${input.idempotencyKey}:collection`,
              collectedAt: new Date(),
              collectedBy: ctx.user.id,
            });
          await writeAudit(tx, ctx.user.id, "create", "sale", saleId, {
            saleNo,
            totalCents,
            lineCount: input.lines.length,
            stockChanges: input.lines.map(line => ({
              productId: line.productId,
              soldPacks: line.packs,
              beforePacks: productRows.get(line.productId)!.available,
              afterPacks: productRows.get(line.productId)!.remaining,
            })),
          });
          return { id: saleId, saleNo, duplicate: false };
        });
      }),
    collect: operatorProcedure
      .input(
        z.object({
          saleId: id,
          kind: z.enum(["collection", "refund"]).default("collection"),
          amountCents: cents.refine(n => n > 0),
          method,
          cashLocation: location.optional(),
          holderUserId: id.optional(),
          deliveryId: id.optional(),
          reference: optionalText(180),
          idempotencyKey,
          collectedAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const [sale] = await db
          .select()
          .from(sales)
          .where(eq(sales.id, input.saleId))
          .limit(1);
        if (!sale) notFound("Sale not found.");
        if (
          ctx.user.role === "operator" &&
          sale.operatorId !== ctx.user.id &&
          sale.createdBy !== ctx.user.id
        )
          badRequest("This sale is not assigned to your account.");
        const [assignedDelivery] = await db
          .select()
          .from(deliveries)
          .where(eq(deliveries.saleId, sale.id))
          .limit(1);
        if (input.deliveryId && assignedDelivery?.id !== input.deliveryId)
          badRequest("Delivery assignment is invalid.");
        if (
          ctx.user.role === "operator" &&
          (!assignedDelivery || assignedDelivery.operatorId !== ctx.user.id)
        )
          badRequest("This sale is not assigned to your delivery route.");
        const loc =
          ctx.user.role === "operator"
            ? "operator"
            : (input.cashLocation ?? "owner");
        checkOperatorCash(ctx.user.role, ctx.user.id, loc, input.holderUserId);
        const cashHolderUserId = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          loc,
          input.holderUserId
        );
        const result = await db.transaction(tx =>
          createCollection(tx, {
            ...input,
            deliveryId: input.deliveryId ?? assignedDelivery?.id,
            cashLocation: loc,
            holderUserId: cashHolderUserId,
            collectedBy: ctx.user.id,
          })
        );
        return result;
      }),
    returnPacks: operatorProcedure
      .input(
        z.object({
          saleId: id,
          saleLineId: id,
          packs: z.number().int().positive(),
          restockable: z.boolean(),
          reason: z.string().trim().min(1).max(240),
          idempotencyKey,
          returnedAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const [sale] = await db
          .select()
          .from(sales)
          .where(eq(sales.id, input.saleId))
          .limit(1);
        if (!sale) notFound("Sale not found.");
        if (
          ctx.user.role === "operator" &&
          sale.operatorId !== ctx.user.id &&
          sale.createdBy !== ctx.user.id
        )
          badRequest("This sale is not assigned to your account.");
        return db.transaction(tx =>
          recordSaleReturn(tx, { ...input, actorId: ctx.user.id })
        );
      }),
  }),

  inventory: router({
    list: operatorProcedure
      .input(
        z.object({ search: z.string().trim().max(100).optional() }).optional()
      )
      .query(async ({ input, ctx }) => {
        const db = requireDatabase(await getDb());
        const filters: any[] = [eq(products.active, true)];
        if (input?.search)
          filters.push(
            or(
              like(products.name, `%${input.search}%`),
              like(products.sku, `%${input.search}%`)
            )
          );
        const productRows = await db
          .select()
          .from(products)
          .where(and(...filters))
          .orderBy(asc(products.name));
        const [movementTotals, recentMovements] = await Promise.all([
          db
            .select({
              productId: inventoryMovements.productId,
              packs: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`,
            })
            .from(inventoryMovements)
            .groupBy(inventoryMovements.productId),
          db
            .select()
            .from(inventoryMovements)
            .orderBy(desc(inventoryMovements.movedAt))
            .limit(1000),
        ]);
        const byProduct = new Map(
          movementTotals.map(movement => [
            movement.productId,
            Number(movement.packs),
          ])
        );
        return productRows.map(product => ({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          variety: product.variety,
          packDescription: product.packDescription,
          stockPacks: byProduct.get(product.id) ?? 0,
          reorderPacks: product.reorderPacks,
          averageCostCents: isOwner(ctx.user.role)
            ? product.averageCostCents
            : null,
          movements: recentMovements
            .filter(
              m =>
                m.productId === product.id &&
                (isOwner(ctx.user.role) || m.actorId === ctx.user.id)
            )
            .slice(0, 8)
            .map(movement => {
              if (isOwner(ctx.user.role)) return movement;
              const { unitCostCents, costValueCents, ...safeMovement } =
                movement;
              return safeMovement;
            }),
        }));
      }),
    movements: operatorProcedure
      .input(z.object({ productId: id.optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const conditions: any[] = [];
        if (input?.productId)
          conditions.push(eq(inventoryMovements.productId, input.productId));
        if (ctx.user.role === "operator")
          conditions.push(eq(inventoryMovements.actorId, ctx.user.id));
        const rows = await db
          .select()
          .from(inventoryMovements)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(inventoryMovements.movedAt))
          .limit(500);
        return isOwner(ctx.user.role)
          ? rows
          : rows.map(
              ({ unitCostCents, costValueCents, ...movement }) => movement
            );
      }),
    count: ownerProcedure
      .input(
        z.object({
          productId: id,
          countedPacks: z.number().int().nonnegative().max(100000),
          idempotencyKey,
          notes: z.string().trim().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, input.productId))
            .for("update")
            .limit(1);
          if (!product) notFound("Product not found.");
          const existing = await tx
            .select()
            .from(inventoryMovements)
            .where(eq(inventoryMovements.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (existing[0]) return { success: true, duplicate: true };
          const current = await stockOnHand(tx, product.id);
          const delta = input.countedPacks - current;
          await tx
            .insert(inventoryMovements)
            .values({
              productId: product.id,
              kind: "stock_count",
              quantityDelta: delta,
              unitCostCents: Number(product.averageCostCents),
              costValueCents: delta * Number(product.averageCostCents),
              sourceType: "stock_count",
              sourceId: null,
              idempotencyKey: input.idempotencyKey,
              notes: input.notes,
              actorId: ctx.user.id,
              movedAt: new Date(),
            });
          await writeAudit(
            tx,
            ctx.user.id,
            "stock_count",
            "product",
            product.id,
            { expected: current, counted: input.countedPacks, delta }
          );
          return { success: true, delta };
        });
      }),
    adjust: ownerProcedure
      .input(
        z.object({
          productId: id,
          kind: z.enum(["damage", "supplier_return", "adjustment"]),
          packs: z.number().int().positive(),
          idempotencyKey,
          notes: z.string().trim().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, input.productId))
            .for("update")
            .limit(1);
          if (!product) notFound("Product not found.");
          const prior = await tx
            .select()
            .from(inventoryMovements)
            .where(eq(inventoryMovements.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior[0]) return { success: true, duplicate: true };
          const current = await stockOnHand(tx, product.id);
          if (current < input.packs)
            badRequest(
              `Only ${current} packs are on hand; adjustment would make stock negative.`
            );
          const value = input.packs * Number(product.averageCostCents);
          await tx
            .insert(inventoryMovements)
            .values({
              productId: product.id,
              kind: input.kind,
              quantityDelta: -input.packs,
              unitCostCents: Number(product.averageCostCents),
              costValueCents: value,
              sourceType: input.kind,
              idempotencyKey: input.idempotencyKey,
              notes: input.notes,
              actorId: ctx.user.id,
              movedAt: new Date(),
            });
          await writeAudit(tx, ctx.user.id, input.kind, "product", product.id, {
            packs: input.packs,
            costCents: value,
            notes: input.notes,
          });
          return { success: true };
        });
      }),
  }),

  deliveries: router({
    list: operatorProcedure.query(async ({ ctx }) => {
      const db = requireDatabase(await getDb());
      const rows = await db
        .select()
        .from(deliveries)
        .where(
          ctx.user.role === "operator"
            ? eq(deliveries.operatorId, ctx.user.id)
            : undefined
        )
        .orderBy(desc(deliveries.assignedAt))
        .limit(300);
      return Promise.all(
        rows.map(async delivery => {
          const [sale] = await db
            .select()
            .from(sales)
            .where(eq(sales.id, delivery.saleId))
            .limit(1);
          const lines = await db
            .select()
            .from(deliveryLines)
            .where(eq(deliveryLines.deliveryId, delivery.id));
          const held = await db
            .select({
              amount: cashMovements.amountCents,
              direction: cashMovements.direction,
              kind: cashMovements.kind,
            })
            .from(cashMovements)
            .where(
              and(
                eq(cashMovements.deliveryId, delivery.id),
                eq(cashMovements.location, "operator")
              )
            );
          const deliveryExpenses = await db
            .select({ amount: expenses.cashPaidCents })
            .from(expenses)
            .where(
              and(
                eq(expenses.deliveryId, delivery.id),
                eq(expenses.paidFrom, "operator")
              )
            );
          const cashDueCents = remittanceOutstandingCents(
            sum(
              held.filter(
                x => x.kind === "sale_collection" && x.direction === "in"
              ),
              x => Number(x.amount)
            ),
            sum(
              held.filter(
                x => x.kind === "customer_refund" && x.direction === "out"
              ),
              x => Number(x.amount)
            ),
            sum(
              held.filter(
                x => x.kind === "operator_remittance" && x.direction === "out"
              ),
              x => Number(x.amount)
            ),
            sum(deliveryExpenses, x => Number(x.amount))
          );
          const trackedLines = lines.map(line => ({
            ...line,
            shortagePacks:
              delivery.status === "discrepancy"
                ? Math.max(
                    0,
                    line.assignedPacks -
                      line.deliveredPacks -
                      line.returnedPacks
                  )
                : 0,
          }));
          return { ...delivery, sale, lines: trackedLines, cashDueCents };
        })
      );
    }),
    assign: ownerProcedure
      .input(z.object({ saleId: id, operatorId: id }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [sale] = await tx
            .select()
            .from(sales)
            .where(eq(sales.id, input.saleId))
            .for("update")
            .limit(1);
          if (!sale || sale.status !== "completed")
            notFound("Completed sale not found.");
          const [operator] = await tx
            .select()
            .from(users)
            .where(eq(users.id, input.operatorId))
            .limit(1);
          if (!operator || operator.role !== "operator")
            badRequest("Select an authorized operator.");
          const existing = await tx
            .select()
            .from(deliveries)
            .where(eq(deliveries.saleId, input.saleId))
            .limit(1);
          if (existing[0])
            badRequest("This sale already has a delivery assignment.");
          const deliveryNo = makeCode("DEL");
          const [inserted] = await tx
            .insert(deliveries)
            .values({
              deliveryNo,
              saleId: input.saleId,
              operatorId: input.operatorId,
              status: "assigned",
              assignedAt: new Date(),
              createdBy: ctx.user.id,
            });
          const deliveryId = Number(inserted.insertId);
          const lines = await tx
            .select()
            .from(saleLines)
            .where(eq(saleLines.saleId, sale.id));
          await tx
            .insert(deliveryLines)
            .values(
              lines.map(line => ({
                deliveryId,
                saleLineId: line.id,
                productId: line.productId,
                assignedPacks: line.packs,
                returnedPacks: 0,
              }))
            );
          await tx
            .update(sales)
            .set({ operatorId: input.operatorId, deliveryStatus: "assigned" })
            .where(eq(sales.id, sale.id));
          await writeAudit(
            tx,
            ctx.user.id,
            "assign_delivery",
            "sale",
            sale.id,
            { deliveryId, operatorId: input.operatorId }
          );
          return { deliveryId, deliveryNo };
        });
      }),
    complete: operatorProcedure
      .input(
        z.object({
          deliveryId: id,
          lineCounts: z
            .array(
              z.object({
                saleLineId: id,
                deliveredPacks: z.number().int().nonnegative().max(100000),
              })
            )
            .default([]),
          returns: z
            .array(
              z.object({
                saleLineId: id,
                packs: z.number().int().nonnegative(),
                restockable: z.boolean(),
                reason: optionalText(240),
              })
            )
            .default([]),
          discrepancyNote: optionalText(),
          notes: optionalText(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [delivery] = await tx
            .select()
            .from(deliveries)
            .where(eq(deliveries.id, input.deliveryId))
            .for("update")
            .limit(1);
          if (!delivery) notFound("Delivery not found.");
          if (
            ctx.user.role === "operator" &&
            delivery.operatorId !== ctx.user.id
          )
            badRequest("This delivery is assigned to a different operator.");
          if (delivery.status !== "assigned")
            badRequest("Only an assigned delivery can be completed.");
          const lines = await tx
            .select()
            .from(deliveryLines)
            .where(eq(deliveryLines.deliveryId, delivery.id));
          if (
            new Set(input.lineCounts.map(item => item.saleLineId)).size !==
              input.lineCounts.length ||
            new Set(input.returns.map(item => item.saleLineId)).size !==
              input.returns.length
          )
            badRequest("Enter each delivery line once.");
          if (
            input.lineCounts.some(
              item => !lines.some(line => line.saleLineId === item.saleLineId)
            ) ||
            input.returns.some(
              item => !lines.some(line => line.saleLineId === item.saleLineId)
            )
          )
            badRequest("A reported pack line is not part of this delivery.");
          for (const returned of input.returns) {
            if (returned.packs <= 0) continue;
            const line = lines.find(
              entry => entry.saleLineId === returned.saleLineId
            )!;
            if (returned.packs > line.assignedPacks)
              badRequest("Returned packs exceed the delivery assignment.");
            await recordSaleReturn(tx, {
              saleId: delivery.saleId,
              saleLineId: returned.saleLineId,
              packs: returned.packs,
              restockable: returned.restockable,
              reason: returned.reason || "Returned during delivery",
              idempotencyKey: `delivery:${delivery.id}:return:${returned.saleLineId}`,
              actorId: ctx.user.id,
              returnedAt: new Date(),
            });
          }
          const outcomes: {
            assignedPacks: number;
            deliveredPacks: number;
            returnedPacks: number;
            shortagePacks: number;
          }[] = [];
          let missingPacks = 0;
          for (const line of lines) {
            const reported = input.lineCounts.find(
              item => item.saleLineId === line.saleLineId
            );
            const returned = input.returns.find(
              item => item.saleLineId === line.saleLineId
            );
            const returnedPacks = returned?.packs ?? 0;
            const deliveredPacks =
              reported?.deliveredPacks ??
              Math.max(0, line.assignedPacks - returnedPacks);
            if (deliveredPacks + returnedPacks > line.assignedPacks)
              badRequest(
                "Delivered plus returned packs cannot exceed the delivery assignment."
              );
            const shortagePacks = deliveryShortagePacks(
              line.assignedPacks,
              deliveredPacks,
              returnedPacks
            );
            missingPacks += shortagePacks;
            outcomes.push({
              assignedPacks: line.assignedPacks,
              deliveredPacks,
              returnedPacks,
              shortagePacks,
            });
            await tx
              .update(deliveryLines)
              .set({ deliveredPacks, returnedPacks })
              .where(eq(deliveryLines.id, line.id));
          }
          if (missingPacks > 0 && !input.discrepancyNote?.trim())
            badRequest(
              "Record a reason for delivery shortages or missing packs."
            );
          const allReturned =
            outcomes.length > 0 &&
            outcomes.every(
              line =>
                line.deliveredPacks === 0 &&
                line.returnedPacks === line.assignedPacks
            );
          const status =
            missingPacks > 0
              ? "discrepancy"
              : allReturned
                ? "returned"
                : "delivered";
          const notes =
            [
              input.notes?.trim(),
              missingPacks > 0
                ? `Shortage (${missingPacks} packs): ${input.discrepancyNote!.trim()}`
                : undefined,
            ]
              .filter(Boolean)
              .join("\n") || null;
          await tx
            .update(deliveries)
            .set({ status, completedAt: new Date(), notes })
            .where(eq(deliveries.id, delivery.id));
          await tx
            .update(sales)
            .set({ deliveryStatus: status })
            .where(eq(sales.id, delivery.saleId));
          await writeAudit(
            tx,
            ctx.user.id,
            "complete_delivery",
            "delivery",
            delivery.id,
            { status, missingPacks, lines: outcomes }
          );
          return { success: true, status, missingPacks };
        });
      }),
  }),

  cash: router({
    list: operatorProcedure
      .input(
        z
          .object({ from: dateInput.optional(), to: dateInput.optional() })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const filters: any[] = [];
        if (input?.from)
          filters.push(gte(cashMovements.occurredAt, input.from));
        if (input?.to) filters.push(lte(cashMovements.occurredAt, input.to));
        if (ctx.user.role === "operator")
          filters.push(
            and(
              eq(cashMovements.location, "operator"),
              eq(cashMovements.holderUserId, ctx.user.id)
            )
          );
        return db
          .select()
          .from(cashMovements)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(cashMovements.occurredAt))
          .limit(500);
      }),
    transfer: operatorProcedure
      .input(
        z.object({
          from: location,
          to: location,
          fromHolderUserId: id.optional(),
          toHolderUserId: id.optional(),
          amountCents: cents.refine(n => n > 0),
          method,
          deliveryId: id.optional(),
          reference: optionalText(180),
          notes: optionalText(),
          idempotencyKey,
          occurredAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.from === input.to)
          badRequest("Choose two different cash locations.");
        if (
          ctx.user.role === "operator" &&
          (input.from !== "operator" ||
            (input.fromHolderUserId &&
              input.fromHolderUserId !== ctx.user.id) ||
            input.to === "operator")
        )
          badRequest(
            "Operators may remit only their own cash to the owner or a business account."
          );
        const db = requireDatabase(await getDb());
        const fromHolder = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          input.from,
          input.fromHolderUserId
        );
        const toHolder = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          input.to,
          input.toHolderUserId
        );
        await checkAvailableCash(db, input.from, input.amountCents, fromHolder);
        return db.transaction(async tx => {
          const group = input.idempotencyKey;
          const duplicate = await tx
            .select()
            .from(cashMovements)
            .where(eq(cashMovements.transferGroupId, group))
            .limit(1);
          if (duplicate[0])
            return { success: true, transferGroupId: group, duplicate: true };
          const lockedFromHolder = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            input.from,
            input.fromHolderUserId
          );
          const lockedToHolder = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            input.to,
            input.toHolderUserId
          );
          if (input.deliveryId) {
            const [delivery] = await tx
              .select()
              .from(deliveries)
              .where(eq(deliveries.id, input.deliveryId))
              .for("update")
              .limit(1);
            if (!delivery) notFound("Delivery not found.");
            if (
              input.from === "operator" &&
              lockedFromHolder !== delivery.operatorId
            )
              badRequest(
                "The linked delivery must belong to the operator cash holder making this remittance."
              );
          }
          await checkAvailableCash(
            tx,
            input.from,
            input.amountCents,
            lockedFromHolder
          );
          const kind =
            input.from === "operator" && input.to !== "operator"
              ? "operator_remittance"
              : "transfer";
          await appendCashMovement(tx, {
            kind,
            direction: "out",
            location: input.from,
            holderUserId: lockedFromHolder,
            deliveryId: input.deliveryId,
            amountCents: input.amountCents,
            method: input.method,
            sourceType: "transfer",
            transferGroupId: group,
            idempotencyKey: `${group}:out`,
            reference: input.reference,
            note: input.notes,
            actorId: ctx.user.id,
            occurredAt: input.occurredAt,
          });
          await appendCashMovement(tx, {
            kind,
            direction: "in",
            location: input.to,
            holderUserId: lockedToHolder,
            deliveryId: input.deliveryId,
            amountCents: input.amountCents,
            method: input.method,
            sourceType: "transfer",
            transferGroupId: group,
            idempotencyKey: `${group}:in`,
            reference: input.reference,
            note: input.notes,
            actorId: ctx.user.id,
            occurredAt: input.occurredAt,
          });
          await writeAudit(tx, ctx.user.id, kind, "cash_transfer", null, {
            from: input.from,
            to: input.to,
            amountCents: input.amountCents,
            deliveryId: input.deliveryId,
          });
          return { success: true, transferGroupId: group, duplicate: false };
        });
      }),
    adjust: ownerProcedure
      .input(
        z.object({
          location,
          holderUserId: id.optional(),
          direction: z.enum(["in", "out"]),
          amountCents: cents.refine(n => n > 0),
          method,
          reference: z.string().trim().min(1).max(180),
          reason: z.string().trim().min(1).max(1000),
          idempotencyKey,
          occurredAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [prior] = await tx
            .select()
            .from(cashMovements)
            .where(eq(cashMovements.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior) return { id: prior.id, duplicate: true };
          const holderUserId = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            input.location,
            input.holderUserId
          );
          if (input.direction === "out")
            await checkAvailableCash(
              tx,
              input.location,
              input.amountCents,
              holderUserId
            );
          await appendCashMovement(tx, {
            kind: "other",
            direction: input.direction,
            location: input.location,
            holderUserId,
            amountCents: input.amountCents,
            method: input.method,
            sourceType: "manual_adjustment",
            reference: input.reference,
            note: input.reason,
            idempotencyKey: input.idempotencyKey,
            actorId: ctx.user.id,
            occurredAt: input.occurredAt,
          });
          await writeAudit(
            tx,
            ctx.user.id,
            "cash_adjustment",
            "cash_movement",
            null,
            {
              location: input.location,
              holderUserId,
              direction: input.direction,
              amountCents: input.amountCents,
              reference: input.reference,
              reason: input.reason,
            }
          );
          return { success: true, duplicate: false };
        });
      }),
    reconcile: operatorProcedure
      .input(
        z.object({
          location,
          holderUserId: id.optional(),
          countedCents: cents,
          notes: optionalText(),
          idempotencyKey,
          countedAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          ctx.user.role === "operator" &&
          (input.location !== "operator" ||
            (input.holderUserId && input.holderUserId !== ctx.user.id))
        )
          badRequest("Operators may reconcile only cash they hold.");
        const db = requireDatabase(await getDb());
        const holder = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          input.location,
          input.holderUserId
        );
        return db.transaction(async tx => {
          const [prior] = await tx
            .select()
            .from(cashReconciliations)
            .where(eq(cashReconciliations.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior)
            return {
              id: prior.id,
              expectedCents: Number(prior.expectedCents),
              differenceCents: Number(prior.differenceCents),
              duplicate: true,
            };
          await tx
            .select({ id: cashMovements.id })
            .from(cashMovements)
            .where(eq(cashMovements.location, input.location))
            .for("update");
          const lockedHolder = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            input.location,
            input.holderUserId
          );
          const expected = await cashBalance(tx, input.location, lockedHolder);
          const difference = cashDifferenceCents(expected, input.countedCents);
          const [result] = await tx
            .insert(cashReconciliations)
            .values({
              location: input.location,
              holderUserId: lockedHolder,
              expectedCents: expected,
              countedCents: input.countedCents,
              differenceCents: difference,
              notes: input.notes || null,
              idempotencyKey: input.idempotencyKey,
              countedBy: ctx.user.id,
              countedAt: input.countedAt,
            });
          const recordId = Number(result.insertId);
          await writeAudit(
            tx,
            ctx.user.id,
            "cash_reconcile",
            "cash_reconciliation",
            recordId,
            {
              location: input.location,
              expected,
              counted: input.countedCents,
              difference,
            }
          );
          return {
            id: recordId,
            expectedCents: expected,
            differenceCents: difference,
            duplicate: false,
          };
        });
      }),
  }),

  expenses: router({
    list: operatorProcedure
      .input(
        z
          .object({ from: dateInput.optional(), to: dateInput.optional() })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const filters: any[] = [];
        if (input?.from) filters.push(gte(expenses.expenseDate, input.from));
        if (input?.to) filters.push(lte(expenses.expenseDate, input.to));
        if (ctx.user.role === "operator")
          filters.push(eq(expenses.createdBy, ctx.user.id));
        const rows = await db
          .select()
          .from(expenses)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(expenses.expenseDate))
          .limit(500);
        const adjustments = ctx.user.role === "owner" && rows.length
          ? await db
              .select()
              .from(expenseAdjustments)
              .where(
                inArray(
                  expenseAdjustments.expenseId,
                  rows.map(row => row.id)
                )
              )
              .orderBy(desc(expenseAdjustments.adjustedAt))
          : [];
        return rows.map(expense => {
          const history = adjustments.filter(
            adjustment => adjustment.expenseId === expense.id
          );
          if (ctx.user.role === "operator") {
            const {
              invoiceAmountCents,
              allocationBps,
              allocationBasis,
              externalAllocationRef,
              sharedVehicle,
              ...operationalExpense
            } = expense;
            return { ...operationalExpense, adjustments: [] };
          }
          return { ...expense, adjustments: history };
        });
      }),
    create: operatorProcedure
      .input(
        z.object({
          idempotencyKey,
          category: z.string().trim().min(1).max(100),
          description: z.string().trim().min(1).max(240),
          invoiceAmountCents: cents.refine(n => n > 0),
          allocationBps: z.number().int().min(1).max(10000).default(10000),
          allocationBasis: optionalText(180),
          externalAllocationRef: optionalText(180),
          sharedVehicle: z.boolean().default(false),
          expenseDate: dateInput,
          status: z.enum(["paid", "unpaid"]).default("unpaid"),
          costType: z.enum(["purchase", "operations"]).default("operations"),
          purchaseId: id.optional(),
          deliveryId: id.optional(),
          receiptRef: optionalText(180),
          paidFrom: location.optional(),
          holderUserId: id.optional(),
          cashPaidCents: cents.default(0),
          notes: optionalText(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          input.sharedVehicle &&
          (!input.allocationBasis ||
            !input.externalAllocationRef ||
            input.allocationBps >= 10000)
        )
          badRequest(
            "For a shared Hyundai H100 expense, document the allocation basis, shared-use reference, and candy-business share below 100%."
          );
        if (!input.sharedVehicle && input.allocationBps !== 10000)
          badRequest(
            "An allocation below 100% must be marked as shared use and documented."
          );
        const allocated = roundRatio(
          input.invoiceAmountCents,
          input.allocationBps,
          10000
        );
        if (allocated <= 0)
          badRequest(
            "The candy-business expense allocation must be at least one centavo."
          );
        if (input.cashPaidCents > allocated)
          badRequest(
            "Cash paid by the candy business cannot exceed its allocated expense share."
          );
        if (input.status === "unpaid" && input.cashPaidCents > 0)
          badRequest(
            "Mark the expense paid when entering an initial cash payment; use the payment action for later payments."
          );
        const db = requireDatabase(await getDb());
        const [duplicate] = await db
          .select()
          .from(expenses)
          .where(eq(expenses.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (duplicate)
          return {
            id: duplicate.id,
            duplicate: true,
            allocatedAmountCents: duplicate.amountCents,
          };
        if (input.costType === "purchase") {
          if (!input.purchaseId)
            badRequest(
              "Select the draft purchase that this acquisition cost belongs to."
            );
          const [purchase] = await db
            .select()
            .from(purchases)
            .where(eq(purchases.id, input.purchaseId))
            .limit(1);
          if (!purchase || purchase.status !== "draft")
            badRequest(
              "Direct purchase costs can be attached only before the goods are received."
            );
        }
        if (ctx.user.role === "operator" && input.costType === "purchase")
          badRequest(
            "Operators cannot alter landed-cost records after purchase creation."
          );
        if (ctx.user.role === "operator") {
          if (!input.deliveryId)
            badRequest(
              "Operator-entered operating expenses must be linked to an assigned delivery."
            );
          const [delivery] = await db
            .select()
            .from(deliveries)
            .where(eq(deliveries.id, input.deliveryId))
            .limit(1);
          if (!delivery || delivery.operatorId !== ctx.user.id)
            badRequest("This delivery is not assigned to your account.");
        }
        const loc =
          ctx.user.role === "operator"
            ? "operator"
            : (input.paidFrom ?? "owner");
        const cashPaid =
          input.status === "paid" ? input.cashPaidCents || allocated : 0;
        const cashHolderUserId =
          cashPaid > 0
            ? await resolveCashHolder(
                db,
                ctx.user.role,
                ctx.user.id,
                loc,
                input.holderUserId
              )
            : null;
        if (cashPaid > 0)
          await checkAvailableCash(db, loc, cashPaid, cashHolderUserId);
        return db.transaction(async tx => {
          const [prior] = await tx
            .select()
            .from(expenses)
            .where(eq(expenses.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior)
            return {
              id: prior.id,
              duplicate: true,
              allocatedAmountCents: prior.amountCents,
            };
          if (input.costType === "purchase") {
            const [lockedPurchase] = await tx
              .select()
              .from(purchases)
              .where(eq(purchases.id, input.purchaseId!))
              .for("update")
              .limit(1);
            if (!lockedPurchase || lockedPurchase.status !== "draft")
              badRequest(
                "Direct purchase costs can be attached only before the goods are received."
              );
          }
          const lockedCashHolder =
            cashPaid > 0
              ? await resolveCashHolder(
                  tx,
                  ctx.user.role,
                  ctx.user.id,
                  loc,
                  input.holderUserId
                )
              : null;
          if (cashPaid > 0)
            await checkAvailableCash(tx, loc, cashPaid, lockedCashHolder);
          const [inserted] = await tx.insert(expenses).values({
            idempotencyKey: input.idempotencyKey,
            category: input.category,
            description: input.description,
            invoiceAmountCents: input.invoiceAmountCents,
            amountCents: allocated,
            cashPaidCents: cashPaid,
            expenseDate: input.expenseDate,
            status: cashPaid >= allocated ? "paid" : "unpaid",
            costType: input.costType,
            purchaseId: input.purchaseId ?? null,
            deliveryId: input.deliveryId ?? null,
            receiptRef: input.receiptRef || null,
            sharedVehicle: input.sharedVehicle,
            allocationBps: input.allocationBps,
            allocationBasis: input.allocationBasis || null,
            externalAllocationRef: input.externalAllocationRef || null,
            paidFrom: cashPaid ? loc : null,
            notes: input.notes || null,
            createdBy: ctx.user.id,
          });
          const expenseId = Number(inserted.insertId);
          if (cashPaid > 0)
            await appendCashMovement(tx, {
              kind: "expense",
              direction: "out",
              location: loc,
              holderUserId: lockedCashHolder,
              deliveryId: input.deliveryId,
              amountCents: cashPaid,
              sourceType: "expense",
              sourceId: expenseId,
              idempotencyKey: `${input.idempotencyKey}:cash`,
              note: input.description,
              actorId: ctx.user.id,
              occurredAt: input.expenseDate,
            });
          await writeAudit(tx, ctx.user.id, "create", "expense", expenseId, {
            allocatedCents: allocated,
            invoiceCents: input.invoiceAmountCents,
            costType: input.costType,
            sharedVehicle: input.sharedVehicle,
            allocationBps: input.allocationBps,
          });
          return {
            id: expenseId,
            duplicate: false,
            allocatedAmountCents: allocated,
          };
        });
      }),
    adjust: ownerProcedure
      .input(
        z.object({
          expenseId: id,
          deltaCents: signedCents.refine(n => n !== 0),
          reference: z.string().trim().min(1).max(180),
          reason: z.string().trim().min(1).max(1000),
          idempotencyKey,
          adjustedAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        return db.transaction(async tx => {
          const [prior] = await tx
            .select()
            .from(expenseAdjustments)
            .where(eq(expenseAdjustments.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior)
            return {
              id: prior.id,
              duplicate: true,
              newAmountCents: Number(prior.newAmountCents),
            };
          const [expense] = await tx
            .select()
            .from(expenses)
            .where(eq(expenses.id, input.expenseId))
            .for("update")
            .limit(1);
          if (!expense) notFound("Expense not found.");
          const previousAmountCents = Number(expense.amountCents);
          const newAmountCents = expenseAdjustmentAmountCents(
            previousAmountCents,
            input.deltaCents,
            Number(expense.cashPaidCents)
          );
          if (newAmountCents === null)
            badRequest(
              "This adjustment would go below zero, below cash already paid, or outside the supported amount range."
            );
          if (expense.costType === "purchase") {
            const [purchase] = await tx
              .select()
              .from(purchases)
              .where(eq(purchases.id, expense.purchaseId!))
              .for("update")
              .limit(1);
            if (!purchase || purchase.status !== "draft")
              badRequest(
                "Landed-cost adjustments are allowed only before purchase receipt; received inventory costing is immutable."
              );
          }
          const [created] = await tx
            .insert(expenseAdjustments)
            .values({
              expenseId: expense.id,
              deltaCents: input.deltaCents,
              previousAmountCents,
              newAmountCents,
              reference: input.reference,
              reason: input.reason,
              idempotencyKey: input.idempotencyKey,
              adjustedAt: input.adjustedAt,
              adjustedBy: ctx.user.id,
            });
          await tx
            .update(expenses)
            .set({
              amountCents: newAmountCents,
              status:
                Number(expense.cashPaidCents) >= newAmountCents
                  ? "paid"
                  : "unpaid",
            })
            .where(eq(expenses.id, expense.id));
          const adjustmentId = Number(created.insertId);
          await writeAudit(tx, ctx.user.id, "adjust", "expense", expense.id, {
            adjustmentId,
            previousAmountCents,
            deltaCents: input.deltaCents,
            newAmountCents,
            reference: input.reference,
            reason: input.reason,
          });
          return {
            id: adjustmentId,
            duplicate: false,
            previousAmountCents,
            newAmountCents,
          };
        });
      }),
    pay: operatorProcedure
      .input(
        z.object({
          expenseId: id,
          amountCents: cents.refine(n => n > 0),
          paidFrom: location.optional(),
          holderUserId: id.optional(),
          method,
          idempotencyKey,
          paidAt: dateInput.default(today()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const [expense] = await db
          .select()
          .from(expenses)
          .where(eq(expenses.id, input.expenseId))
          .limit(1);
        if (!expense) notFound("Expense not found.");
        if (ctx.user.role === "operator" && expense.createdBy !== ctx.user.id)
          badRequest("This expense is not assigned to your account.");
        if (
          Number(expense.cashPaidCents) + input.amountCents >
          Number(expense.amountCents)
        )
          badRequest(
            "Cumulative payments cannot exceed the candy-business expense allocation."
          );
        const loc =
          ctx.user.role === "operator"
            ? "operator"
            : (input.paidFrom ?? expense.paidFrom ?? "owner");
        const cashHolderUserId = await resolveCashHolder(
          db,
          ctx.user.role,
          ctx.user.id,
          loc,
          input.holderUserId
        );
        await checkAvailableCash(db, loc, input.amountCents, cashHolderUserId);
        return db.transaction(async tx => {
          const prior = await tx
            .select()
            .from(cashMovements)
            .where(
              eq(cashMovements.idempotencyKey, `${input.idempotencyKey}:cash`)
            )
            .limit(1);
          if (prior[0]) return { success: true, duplicate: true };
          const [lockedExpense] = await tx
            .select()
            .from(expenses)
            .where(eq(expenses.id, input.expenseId))
            .for("update")
            .limit(1);
          if (!lockedExpense) notFound("Expense not found.");
          if (
            ctx.user.role === "operator" &&
            lockedExpense.createdBy !== ctx.user.id
          )
            badRequest("This expense is not assigned to your account.");
          const paidBefore = Number(lockedExpense.cashPaidCents);
          if (
            paidBefore + input.amountCents >
            Number(lockedExpense.amountCents)
          )
            badRequest(
              "Cumulative payments cannot exceed the candy-business expense allocation."
            );
          const lockedCashHolder = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            loc,
            input.holderUserId
          );
          await checkAvailableCash(
            tx,
            loc,
            input.amountCents,
            lockedCashHolder
          );
          await appendCashMovement(tx, {
            kind: "expense",
            direction: "out",
            location: loc,
            holderUserId: lockedCashHolder,
            deliveryId: lockedExpense.deliveryId,
            amountCents: input.amountCents,
            method: input.method,
            sourceType: "expense",
            sourceId: lockedExpense.id,
            idempotencyKey: `${input.idempotencyKey}:cash`,
            actorId: ctx.user.id,
            note: lockedExpense.description,
            occurredAt: input.paidAt,
          });
          const paid = paidBefore + input.amountCents;
          await tx
            .update(expenses)
            .set({
              cashPaidCents: paid,
              status:
                paid >= Number(lockedExpense.amountCents) ? "paid" : "unpaid",
              paidFrom: loc,
            })
            .where(eq(expenses.id, lockedExpense.id));
          await writeAudit(
            tx,
            ctx.user.id,
            "pay",
            "expense",
            lockedExpense.id,
            { amountCents: input.amountCents }
          );
          return { success: true, duplicate: false };
        });
      }),
  }),

  capital: router({
    summary: ownerProcedure.query(async () => {
      const db = requireDatabase(await getDb());
      const [settingRows, investorRows, ownershipRows, transactionRows] =
        await Promise.all([
          db.select().from(businessSettings).limit(1),
          db.select().from(investors).orderBy(asc(investors.name)),
          db
            .select()
            .from(ownershipRecords)
            .orderBy(desc(ownershipRecords.effectiveDate)),
          db
            .select()
            .from(capitalTransactions)
            .orderBy(desc(capitalTransactions.happenedAt)),
        ]);
      return {
        settings: settingRows[0] ?? {
          initialBudgetCents: 2500000,
          initialInvestorName: "Gale",
          turnoverTargetDays: 7,
        },
        investors: investorRows,
        ownership: ownershipRows,
        transactions: transactionRows,
      };
    }),
    initializeSoleInvestor: ownerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(180).optional(),
          effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          agreementReference: optionalText(180),
          notes: optionalText(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const effectiveDate = new Date(`${input.effectiveDate}T00:00:00.000Z`);
        return db.transaction(async tx => {
          const active = await tx
            .select({ id: investors.id })
            .from(investors)
            .where(eq(investors.active, true))
            .for("update");
          if (active.length)
            badRequest("The initial sole investor has already been recorded.");
          const [settings] = await tx.select().from(businessSettings).limit(1);
          const name = input.name || settings?.initialInvestorName || "Gale";
          const [result] = await tx
            .insert(investors)
            .values({ name, notes: input.notes || null });
          const investorId = Number(result.insertId);
          await tx
            .insert(ownershipRecords)
            .values({
              investorId,
              percentageBps: 10000,
              effectiveDate,
              agreementReference: input.agreementReference || null,
              notes: input.notes || null,
              authorizedBy: ctx.user.id,
            });
          await writeAudit(
            tx,
            ctx.user.id,
            "initialize_sole_investor",
            "investor",
            investorId,
            { name, percentageBps: 10000, effectiveDate: input.effectiveDate }
          );
          return { id: investorId, duplicate: false };
        });
      }),
    addInvestor: ownerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(180),
          notes: optionalText(),
          contributionCents: cents.refine(n => n > 0),
          cashLocation: location,
          holderUserId: id.optional(),
          method,
          happenedAt: dateInput,
          effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          agreementReference: z.string().trim().min(1).max(180),
          newPercentageBps: z.number().int().min(1).max(10000),
          existingShares: z
            .array(
              z.object({
                investorId: id,
                percentageBps: z.number().int().min(0).max(10000),
              })
            )
            .min(1)
            .max(29),
          idempotencyKey,
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          input.existingShares.reduce(
            (n, share) => n + share.percentageBps,
            input.newPercentageBps
          ) !== 10000
        )
          badRequest(
            "The authorized ownership agreement must allocate exactly 100% across all investors."
          );
        if (
          new Set(input.existingShares.map(share => share.investorId)).size !==
          input.existingShares.length
        )
          badRequest(
            "Each existing investor may appear only once in the ownership agreement."
          );
        const db = requireDatabase(await getDb());
        const effectiveDate = new Date(`${input.effectiveDate}T00:00:00.000Z`);
        return db.transaction(async tx => {
          const [prior] = await tx
            .select()
            .from(capitalTransactions)
            .where(eq(capitalTransactions.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior) {
            if (prior.kind !== "contribution" || !prior.investorId)
              badRequest(
                "This idempotency key belongs to another capital transaction."
              );
            return { id: prior.investorId, duplicate: true };
          }
          const active = await tx
            .select({ id: investors.id })
            .from(investors)
            .where(eq(investors.active, true))
            .for("update");
          if (!active.length)
            badRequest(
              "Record Gale as the initial sole investor before adding a future investor."
            );
          const cashHolderUserId = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            input.cashLocation,
            input.holderUserId
          );
          if (
            active.length !== input.existingShares.length ||
            active.some(
              investor =>
                !input.existingShares.some(
                  share => share.investorId === investor.id
                )
            )
          )
            badRequest(
              "Include every current active investor in the new ownership agreement."
            );
          const [priorOwnership] = await tx
            .select()
            .from(ownershipRecords)
            .where(eq(ownershipRecords.effectiveDate, effectiveDate))
            .limit(1);
          if (priorOwnership)
            badRequest(
              "Ownership for this effective date already exists. Use a new effective date to preserve history."
            );
          const [investorResult] = await tx
            .insert(investors)
            .values({ name: input.name, notes: input.notes || null });
          const investorId = Number(investorResult.insertId);
          const [capitalResult] = await tx
            .insert(capitalTransactions)
            .values({
              kind: "contribution",
              investorId,
              amountCents: input.contributionCents,
              cashLocation: input.cashLocation,
              happenedAt: input.happenedAt,
              reference: input.agreementReference,
              idempotencyKey: input.idempotencyKey,
              notes: input.notes || null,
              authorizedBy: ctx.user.id,
            });
          const transactionId = Number(capitalResult.insertId);
          await appendCashMovement(tx, {
            kind: "capital_contribution",
            direction: "in",
            location: input.cashLocation,
            holderUserId: cashHolderUserId,
            amountCents: input.contributionCents,
            method: input.method,
            sourceType: "capital_transaction",
            sourceId: transactionId,
            idempotencyKey: `${input.idempotencyKey}:cash`,
            reference: input.agreementReference,
            note: input.notes,
            actorId: ctx.user.id,
            occurredAt: input.happenedAt,
          });
          await tx
            .insert(ownershipRecords)
            .values([
              ...input.existingShares.map(share => ({
                investorId: share.investorId,
                percentageBps: share.percentageBps,
                effectiveDate,
                agreementReference: input.agreementReference,
                notes: input.notes || null,
                authorizedBy: ctx.user.id,
              })),
              {
                investorId,
                percentageBps: input.newPercentageBps,
                effectiveDate,
                agreementReference: input.agreementReference,
                notes: input.notes || null,
                authorizedBy: ctx.user.id,
              },
            ]);
          await writeAudit(
            tx,
            ctx.user.id,
            "add_investor_with_capital_and_ownership",
            "investor",
            investorId,
            {
              contributionCents: input.contributionCents,
              agreementReference: input.agreementReference,
              effectiveDate: input.effectiveDate,
              newPercentageBps: input.newPercentageBps,
              existingShares: input.existingShares,
            }
          );
          return { id: investorId, duplicate: false };
        });
      }),
    setOwnership: ownerProcedure
      .input(
        z.object({
          effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          agreementReference: z.string().trim().min(1).max(180),
          notes: optionalText(),
          shares: z
            .array(
              z.object({
                investorId: id,
                percentageBps: z.number().int().min(0).max(10000),
              })
            )
            .min(1)
            .max(30),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.shares.reduce((n, x) => n + x.percentageBps, 0) !== 10000)
          badRequest(
            "Effective ownership percentages must total exactly 100%."
          );
        if (
          new Set(input.shares.map(x => x.investorId)).size !==
          input.shares.length
        )
          badRequest(
            "Each investor may appear only once for an effective date."
          );
        const db = requireDatabase(await getDb());
        const effectiveDate = new Date(`${input.effectiveDate}T00:00:00.000Z`);
        return db.transaction(async tx => {
          const activeInvestors = await tx
            .select({ id: investors.id })
            .from(investors)
            .where(eq(investors.active, true))
            .for("update");
          const prior = await tx
            .select()
            .from(ownershipRecords)
            .where(eq(ownershipRecords.effectiveDate, effectiveDate))
            .limit(1);
          if (prior[0])
            badRequest(
              "Ownership for this effective date already exists. Preserve history by using a new effective date."
            );
          const known = await tx
            .select()
            .from(investors)
            .where(
              inArray(
                investors.id,
                input.shares.map(x => x.investorId)
              )
            );
          if (known.length !== input.shares.length)
            badRequest("One or more investors are not registered.");
          if (
            activeInvestors.length !== input.shares.length ||
            activeInvestors.some(
              investor =>
                !input.shares.some(share => share.investorId === investor.id)
            )
          )
            badRequest(
              "An effective ownership snapshot must include every active investor."
            );
          await tx
            .insert(ownershipRecords)
            .values(
              input.shares.map(share => ({
                investorId: share.investorId,
                percentageBps: share.percentageBps,
                effectiveDate,
                agreementReference: input.agreementReference,
                notes: input.notes || null,
                authorizedBy: ctx.user.id,
              }))
            );
          await writeAudit(
            tx,
            ctx.user.id,
            "set_ownership",
            "ownership",
            null,
            { effectiveDate: input.effectiveDate, shares: input.shares }
          );
          return { success: true };
        });
      }),
    record: ownerProcedure
      .input(
        z.object({
          kind: z.enum(["contribution", "withdrawal", "distribution"]),
          investorId: id,
          amountCents: cents.refine(n => n > 0),
          cashLocation: location,
          holderUserId: id.optional(),
          happenedAt: dateInput,
          reference: optionalText(180),
          notes: optionalText(),
          idempotencyKey,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const direction = input.kind === "contribution" ? "in" : "out";
        return db.transaction(async tx => {
          const [prior] = await tx
            .select()
            .from(capitalTransactions)
            .where(eq(capitalTransactions.idempotencyKey, input.idempotencyKey))
            .limit(1);
          if (prior) return { id: prior.id, duplicate: true };
          await tx
            .select({ id: investors.id })
            .from(investors)
            .where(eq(investors.active, true))
            .for("update");
          const [investor] = await tx
            .select()
            .from(investors)
            .where(
              and(
                eq(investors.id, input.investorId),
                eq(investors.active, true)
              )
            )
            .limit(1);
          if (!investor) notFound("Active investor not found.");
          const cashHolderUserId = await resolveCashHolder(
            tx,
            ctx.user.role,
            ctx.user.id,
            input.cashLocation,
            input.holderUserId
          );
          if (direction === "out")
            await checkAvailableCash(
              tx,
              input.cashLocation,
              input.amountCents,
              cashHolderUserId
            );
          if (input.kind === "distribution") {
            const [
              saleRows,
              returnRows,
              lineRows,
              operatingRows,
              inventoryRows,
              distributionRows,
            ] = await Promise.all([
              tx.select().from(sales).where(eq(sales.status, "completed")),
              tx.select().from(salesReturns),
              tx.select().from(saleLines),
              tx
                .select()
                .from(expenses)
                .where(eq(expenses.costType, "operations")),
              tx.select().from(inventoryMovements),
              tx
                .select()
                .from(capitalTransactions)
                .where(eq(capitalTransactions.kind, "distribution")),
            ]);
            const saleIds = new Set(saleRows.map(sale => sale.id));
            const returnedCogs = sum(
              returnRows.filter(ret => ret.restockable),
              ret => {
                const line = lineRows.find(item => item.id === ret.saleLineId);
                return line ? Number(line.unitCostCents) * ret.packs : 0;
              }
            );
            const inventoryWriteoffs = sum(
              inventoryRows.filter(
                movement =>
                  ["damage", "stock_count", "adjustment"].includes(
                    movement.kind
                  ) && movement.quantityDelta < 0
              ),
              movement =>
                -movement.quantityDelta * Number(movement.unitCostCents)
            );
            const netProfit =
              sum(saleRows, sale => sale.totalCents) -
              sum(returnRows, ret => ret.creditCents) -
              (sum(
                lineRows.filter(line => saleIds.has(line.saleId)),
                line => line.cogsCents
              ) -
                returnedCogs) -
              sum(operatingRows, expense => expense.amountCents) -
              inventoryWriteoffs;
            const retained =
              netProfit -
              sum(distributionRows, distribution => distribution.amountCents);
            if (input.amountCents > Math.max(0, retained))
              badRequest(
                "A distribution cannot exceed recorded undistributed net profit."
              );
          }
          const [result] = await tx
            .insert(capitalTransactions)
            .values({
              kind: input.kind,
              investorId: input.investorId,
              amountCents: input.amountCents,
              cashLocation: input.cashLocation,
              happenedAt: input.happenedAt,
              reference: input.reference || null,
              idempotencyKey: input.idempotencyKey,
              notes: input.notes || null,
              authorizedBy: ctx.user.id,
            });
          const transactionId = Number(result.insertId);
          const cashKind =
            input.kind === "contribution"
              ? "capital_contribution"
              : input.kind === "withdrawal"
                ? "withdrawal"
                : "profit_distribution";
          await appendCashMovement(tx, {
            kind: cashKind,
            direction,
            location: input.cashLocation,
            holderUserId: cashHolderUserId,
            amountCents: input.amountCents,
            sourceType: "capital_transaction",
            sourceId: transactionId,
            idempotencyKey: `${input.idempotencyKey}:cash`,
            actorId: ctx.user.id,
            reference: input.reference,
            note: input.notes,
            occurredAt: input.happenedAt,
          });
          await writeAudit(
            tx,
            ctx.user.id,
            input.kind,
            "capital_transaction",
            transactionId,
            { investorId: input.investorId, amountCents: input.amountCents }
          );
          return { id: transactionId, duplicate: false };
        });
      }),
  }),

  settings: router({
    get: ownerProcedure.query(async () => {
      const db = requireDatabase(await getDb());
      const [row] = await db.select().from(businessSettings).limit(1);
      return (
        row ?? {
          id: 0,
          initialBudgetCents: 2500000,
          initialInvestorName: "Gale",
          turnoverTargetDays: 7,
          purchasingLocation: "Divisoria, Philippines",
          updatedBy: null,
          createdAt: null,
          updatedAt: null,
        }
      );
    }),
    update: ownerProcedure
      .input(
        z.object({
          initialBudgetCents: cents,
          initialInvestorName: z.string().trim().min(1).max(180),
          turnoverTargetDays: z.number().int().positive().max(365),
          purchasingLocation: z.string().trim().min(1).max(180),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = requireDatabase(await getDb());
        const [existing] = await db.select().from(businessSettings).limit(1);
        if (existing)
          await db
            .update(businessSettings)
            .set({ ...input, updatedBy: ctx.user.id })
            .where(eq(businessSettings.id, existing.id));
        else
          await db
            .insert(businessSettings)
            .values({ ...input, updatedBy: ctx.user.id });
        await writeAudit(
          db,
          ctx.user.id,
          "update",
          "business_settings",
          existing?.id ?? null,
          { ...input }
        );
        return { success: true };
      }),
  }),

  reports: router({
    dashboard: ownerProcedure
      .input(z.object({ from: dateInput, to: dateInput }))
      .query(async ({ input }) => {
        if (input.from > input.to)
          badRequest("Start date must not be after end date.");
        const db = requireDatabase(await getDb());
        const [
          periodSales,
          periodReturns,
          periodCollections,
          periodExpenses,
          allSales,
          allReturns,
          allCollections,
          allExpenses,
          purchaseCostExpenses,
          allSaleLines,
          productsRows,
          movementRows,
          purchaseRows,
          supplierPayRows,
          capitalRows,
          cashRows,
          deliveriesRows,
          reconcileRows,
          settingsRows,
        ] = await Promise.all([
          db
            .select()
            .from(sales)
            .where(
              and(
                eq(sales.status, "completed"),
                gte(sales.saleDate, input.from),
                lte(sales.saleDate, input.to)
              )
            ),
          db
            .select()
            .from(salesReturns)
            .where(
              and(
                gte(salesReturns.returnedAt, input.from),
                lte(salesReturns.returnedAt, input.to)
              )
            ),
          db
            .select()
            .from(collections)
            .where(
              and(
                gte(collections.collectedAt, input.from),
                lte(collections.collectedAt, input.to)
              )
            ),
          db
            .select()
            .from(expenses)
            .where(
              and(
                eq(expenses.costType, "operations"),
                gte(expenses.expenseDate, input.from),
                lte(expenses.expenseDate, input.to)
              )
            ),
          db.select().from(sales).where(eq(sales.status, "completed")),
          db.select().from(salesReturns),
          db.select().from(collections),
          db.select().from(expenses).where(eq(expenses.costType, "operations")),
          db.select().from(expenses).where(eq(expenses.costType, "purchase")),
          db.select().from(saleLines),
          db.select().from(products),
          db.select().from(inventoryMovements),
          db.select().from(purchases),
          db.select().from(supplierPayments),
          db.select().from(capitalTransactions),
          db.select().from(cashMovements),
          db.select().from(deliveries),
          db
            .select()
            .from(cashReconciliations)
            .orderBy(desc(cashReconciliations.countedAt)),
          db.select().from(businessSettings).limit(1),
        ]);
        const total = (rows: any[], key: string) => sum(rows, row => row[key]);
        const periodSaleIds = new Set(periodSales.map(x => x.id));
        const allSaleIds = new Set(allSales.map(x => x.id));
        const periodSaleLines = allSaleLines.filter(x =>
          periodSaleIds.has(x.saleId)
        );
        const lifetimeSaleLines = allSaleLines.filter(x =>
          allSaleIds.has(x.saleId)
        );
        const periodRevenue =
          total(periodSales, "totalCents") -
          total(periodReturns, "creditCents");
        const lifetimeRevenue =
          total(allSales, "totalCents") - total(allReturns, "creditCents");
        const periodReturnedCogs = sum(
          periodReturns.filter(r => r.restockable),
          r => {
            const line = allSaleLines.find(x => x.id === r.saleLineId);
            return line ? Number(line.unitCostCents) * r.packs : 0;
          }
        );
        const lifetimeReturnedCogs = sum(
          allReturns.filter(r => r.restockable),
          r => {
            const line = allSaleLines.find(x => x.id === r.saleLineId);
            return line ? Number(line.unitCostCents) * r.packs : 0;
          }
        );
        const periodCogs =
          total(periodSaleLines, "cogsCents") - periodReturnedCogs;
        const lifetimeCogs =
          total(lifetimeSaleLines, "cogsCents") - lifetimeReturnedCogs;
        const periodOperating = total(periodExpenses, "amountCents");
        const lifetimeOperating = total(allExpenses, "amountCents");
        const periodInventoryWriteoffs = sum(
          movementRows.filter(
            m =>
              ["damage", "stock_count", "adjustment"].includes(m.kind) &&
              m.quantityDelta < 0 &&
              new Date(m.movedAt) >= input.from &&
              new Date(m.movedAt) <= input.to
          ),
          m => -m.quantityDelta * Number(m.unitCostCents)
        );
        const lifetimeInventoryWriteoffs = sum(
          movementRows.filter(
            m =>
              ["damage", "stock_count", "adjustment"].includes(m.kind) &&
              m.quantityDelta < 0
          ),
          m => -m.quantityDelta * Number(m.unitCostCents)
        );
        const soldPacks =
          sum(periodSaleLines, line => line.packs) -
          total(periodReturns, "packs");
        const openingPacks = sum(
          movementRows.filter(m => new Date(m.movedAt) < input.from),
          m => m.quantityDelta
        );
        const receivedPacks = sum(
          movementRows.filter(
            m =>
              m.kind === "receipt" &&
              new Date(m.movedAt) >= input.from &&
              new Date(m.movedAt) <= input.to
          ),
          m => m.quantityDelta
        );
        const sellThroughBps = percentageBps(
          Math.max(0, soldPacks),
          Math.max(0, openingPacks + receivedPacks)
        );
        const stockByProduct = new Map<number, number>();
        for (const movement of movementRows)
          stockByProduct.set(
            movement.productId,
            (stockByProduct.get(movement.productId) ?? 0) +
              movement.quantityDelta
          );
        const stockPacks = sum(Array.from(stockByProduct.values()), v => v);
        const inventoryValue = productsRows.reduce(
          (v, p) =>
            v +
            Math.max(0, stockByProduct.get(p.id) ?? 0) *
              Number(p.averageCostCents),
          0
        );
        const lowStock = productsRows
          .filter(
            p => p.active && (stockByProduct.get(p.id) ?? 0) <= p.reorderPacks
          )
          .map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            stockPacks: stockByProduct.get(p.id) ?? 0,
            reorderPacks: p.reorderPacks,
          }));
        const cashBalances: Record<string, number> = {
          owner: 0,
          operator: 0,
          business_account: 0,
        };
        const byOperator = new Map<number, number>();
        for (const movement of cashRows) {
          const signed =
            (movement.direction === "in" ? 1 : -1) *
            Number(movement.amountCents);
          cashBalances[movement.location] += signed;
          if (movement.location === "operator" && movement.holderUserId)
            byOperator.set(
              movement.holderUserId,
              (byOperator.get(movement.holderUserId) ?? 0) + signed
            );
        }
        const cashTotal = sum(Object.values(cashBalances), x => x);
        const collectionBySale = new Map<number, number>();
        for (const collection of allCollections)
          collectionBySale.set(
            collection.saleId,
            (collectionBySale.get(collection.saleId) ?? 0) +
              (collection.kind === "collection"
                ? Number(collection.amountCents)
                : -Number(collection.amountCents))
          );
        const returnBySale = new Map<number, number>();
        for (const ret of allReturns)
          returnBySale.set(
            ret.saleId,
            (returnBySale.get(ret.saleId) ?? 0) + Number(ret.creditCents)
          );
        const receivables = sum(allSales, sale =>
          Math.max(
            0,
            Number(sale.totalCents) -
              (returnBySale.get(sale.id) ?? 0) -
              (collectionBySale.get(sale.id) ?? 0)
          )
        );
        const payByPurchase = new Map<number, number>();
        for (const payment of supplierPayRows)
          payByPurchase.set(
            payment.purchaseId,
            (payByPurchase.get(payment.purchaseId) ?? 0) +
              Number(payment.amountCents)
          );
        const purchaseLiabilities =
          sum(
            purchaseRows.filter(p => p.status === "received"),
            p =>
              Math.max(
                0,
                Number(p.subtotalCents) +
                  Number(p.acquisitionCostsCents) -
                  (payByPurchase.get(p.id) ?? 0)
              )
          ) +
          sum(purchaseCostExpenses, e =>
            Math.max(0, Number(e.amountCents) - Number(e.cashPaidCents))
          );
        const expenseLiabilities = sum(
          allExpenses.filter(e => e.costType === "operations"),
          e => Math.max(0, Number(e.amountCents) - Number(e.cashPaidCents))
        );
        const liabilities = purchaseLiabilities + expenseLiabilities;
        const capitalIn = total(
          capitalRows.filter(x => x.kind === "contribution"),
          "amountCents"
        );
        const capitalOut = total(
          capitalRows.filter(x => x.kind === "withdrawal"),
          "amountCents"
        );
        const distributions = total(
          capitalRows.filter(x => x.kind === "distribution"),
          "amountCents"
        );
        const lifetimeNetProfit =
          lifetimeRevenue -
          lifetimeCogs -
          lifetimeOperating -
          lifetimeInventoryWriteoffs;
        const retainedEarnings = lifetimeNetProfit - distributions;
        const workingCapital =
          cashTotal + receivables + inventoryValue - liabilities;
        const estimatedReinvestment = reinvestmentCapacityCents(
          cashTotal,
          receivables,
          liabilities
        );
        const remittanceOutstanding = sum(deliveriesRows, delivery => {
          const collected = sum(
            cashRows.filter(
              m =>
                m.deliveryId === delivery.id &&
                m.location === "operator" &&
                m.kind === "sale_collection"
            ),
            m => (m.direction === "in" ? m.amountCents : -m.amountCents)
          );
          const refunds = sum(
            cashRows.filter(
              m =>
                m.deliveryId === delivery.id &&
                m.location === "operator" &&
                m.kind === "customer_refund" &&
                m.direction === "out"
            ),
            m => m.amountCents
          );
          const remitted = sum(
            cashRows.filter(
              m =>
                m.deliveryId === delivery.id &&
                m.kind === "operator_remittance" &&
                m.direction === "out"
            ),
            m => m.amountCents
          );
          const deliveryPaidExpenses = sum(
            allExpenses.filter(
              e => e.deliveryId === delivery.id && e.paidFrom === "operator"
            ),
            e => Math.min(Number(e.amountCents), Number(e.cashPaidCents))
          );
          return remittanceOutstandingCents(
            collected,
            refunds,
            remitted,
            deliveryPaidExpenses
          );
        });
        const seenReconciliations = new Set<string>();
        const latestDiscrepancies = reconcileRows.filter(item => {
          const key = `${item.location}:${item.holderUserId ?? "business"}`;
          if (seenReconciliations.has(key)) return false;
          seenReconciliations.add(key);
          return true;
        });
        return {
          currency: "PHP",
          selectedRange: { from: input.from, to: input.to },
          period: {
            revenueCents: periodRevenue,
            collectionsCents:
              total(
                periodCollections.filter(x => x.kind === "collection"),
                "amountCents"
              ) -
              total(
                periodCollections.filter(x => x.kind === "refund"),
                "amountCents"
              ),
            cogsCents: periodCogs,
            grossProfitCents: periodRevenue - periodCogs,
            inventoryWriteoffsCents: periodInventoryWriteoffs,
            operatingExpensesCents: periodOperating,
            netProfitCents:
              periodRevenue -
              periodCogs -
              periodOperating -
              periodInventoryWriteoffs,
            salesCount: periodSales.length,
            soldPacks,
            sellThroughBps,
          },
          position: {
            cashByLocation: cashBalances,
            cashTotalCents: cashTotal,
            operatorCashCents: sum(Array.from(byOperator.values()), v => v),
            remittanceOutstandingCents: remittanceOutstanding,
            inventoryPacks: stockPacks,
            inventoryValueCents: inventoryValue,
            accountsReceivableCents: receivables,
            liabilitiesCents: liabilities,
            workingCapitalCents: workingCapital,
            estimatedReinvestmentCents: estimatedReinvestment,
            initialBudgetCents: settingsRows[0]?.initialBudgetCents ?? 2500000,
            initialInvestorName: settingsRows[0]?.initialInvestorName ?? "Gale",
            initialCapitalContributionsCents: capitalIn,
            capitalWithdrawalsCents: capitalOut,
            profitDistributionsCents: distributions,
            retainedEarningsCents: retainedEarnings,
            latestCashDiscrepancies: latestDiscrepancies,
            lowStock,
          },
        };
      }),
    weekly: ownerProcedure
      .input(z.object({ from: dateInput, to: dateInput }))
      .query(async ({ input }) => {
        if (input.from > input.to)
          badRequest("Start date must not be after end date.");
        const db = requireDatabase(await getDb());
        const records = await db
          .select()
          .from(sales)
          .where(
            and(
              eq(sales.status, "completed"),
              gte(sales.saleDate, input.from),
              lte(sales.saleDate, input.to)
            )
          )
          .orderBy(desc(sales.saleDate));
        const ids = records.map(record => record.id);
        const items = ids.length
          ? await db
              .select()
              .from(saleLines)
              .where(inArray(saleLines.saleId, ids))
          : [];
        const refunds = ids.length
          ? await db
              .select()
              .from(salesReturns)
              .where(
                and(
                  inArray(salesReturns.saleId, ids),
                  gte(salesReturns.returnedAt, input.from),
                  lte(salesReturns.returnedAt, input.to)
                )
              )
          : [];
        const productsBreakdown = new Map<
          string,
          { packs: number; revenueCents: number }
        >();
        for (const line of items) {
          const entry = productsBreakdown.get(line.productName) ?? {
            packs: 0,
            revenueCents: 0,
          };
          entry.packs += line.packs;
          entry.revenueCents += Number(line.lineTotalCents);
          productsBreakdown.set(line.productName, entry);
        }
        const customersBreakdown = new Map<
          string,
          { invoices: number; revenueCents: number }
        >();
        for (const sale of records) {
          const entry = customersBreakdown.get(sale.storeName) ?? {
            invoices: 0,
            revenueCents: 0,
          };
          entry.invoices += 1;
          entry.revenueCents += Number(sale.totalCents);
          customersBreakdown.set(sale.storeName, entry);
        }
        return {
          from: input.from,
          to: input.to,
          sales: records,
          productBreakdown: Array.from(productsBreakdown, ([name, value]) => ({
            name,
            ...value,
          })).sort((a, b) => b.revenueCents - a.revenueCents),
          customerBreakdown: Array.from(
            customersBreakdown,
            ([name, value]) => ({ name, ...value })
          ).sort((a, b) => b.revenueCents - a.revenueCents),
          returnCreditsCents: sum(refunds, x => x.creditCents),
        };
      }),
  }),

  operations: router({
    summary: operatorProcedure.query(async ({ ctx }) => {
      const db = requireDatabase(await getDb());
      const [assigned, stockRows] = await Promise.all([
        db
          .select()
          .from(deliveries)
          .where(
            and(
              eq(deliveries.operatorId, ctx.user.id),
              eq(deliveries.status, "assigned")
            )
          )
          .orderBy(asc(deliveries.assignedAt)),
        db
          .select({
            productId: inventoryMovements.productId,
            packs: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`,
          })
          .from(inventoryMovements)
          .groupBy(inventoryMovements.productId),
      ]);
      const stockMap = new Map(
        stockRows.map(r => [r.productId, Number(r.packs)])
      );
      const productRows = await db
        .select()
        .from(products)
        .where(eq(products.active, true));
      return {
        assignedDeliveryCount: assigned.length,
        assignedDeliveries: assigned,
        lowStock: productRows
          .filter(p => (stockMap.get(p.id) ?? 0) <= p.reorderPacks)
          .map(p => ({
            name: p.name,
            stockPacks: stockMap.get(p.id) ?? 0,
            reorderPacks: p.reorderPacks,
          })),
      };
    }),
  }),

  audit: router({
    list: ownerProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(200).default(100) })
          .optional()
      )
      .query(async ({ input }) => {
        const db = requireDatabase(await getDb());
        return db
          .select()
          .from(auditLogs)
          .orderBy(desc(auditLogs.happenedAt))
          .limit(input?.limit ?? 100);
      }),
  }),
});
