import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { auditLogs, cashMovements, collections, inventoryMovements, sales, salesReturns } from "../drizzle/schema";
import { getDb } from "./db";

export type Store = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type CashLocation = "owner" | "operator" | "business_account";
export type PaymentMethod = "cash" | "bank_transfer" | "e_wallet" | "check" | "other";

export function requireDatabase(db: Store | null): Store {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Business database is unavailable." });
  return db;
}

export function makeCode(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function writeAudit(tx: any, actorId: number, action: string, recordType: string, recordId: number | null, details?: unknown) {
  await tx.insert(auditLogs).values({
    actorId,
    action,
    recordType,
    recordId,
    details: details === undefined ? null : JSON.stringify(details),
    happenedAt: new Date(),
  });
}

export async function stockOnHand(q: any, productId: number): Promise<number> {
  const [row] = await q.select({ quantity: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)` })
    .from(inventoryMovements).where(eq(inventoryMovements.productId, productId));
  return Number(row?.quantity ?? 0);
}

export async function cashBalance(q: any, location: CashLocation, holderUserId: number | null = null): Promise<number> {
  const conditions: any[] = [eq(cashMovements.location, location)];
  if (location === "operator" && holderUserId !== null) conditions.push(eq(cashMovements.holderUserId, holderUserId));
  if (location === "owner" && holderUserId === null) conditions.push(isNull(cashMovements.holderUserId));
  const rows = await q.select({ direction: cashMovements.direction, amount: cashMovements.amountCents })
    .from(cashMovements).where(and(...conditions));
  return rows.reduce((sum: number, row: { direction: "in" | "out"; amount: number }) => sum + (row.direction === "in" ? Number(row.amount) : -Number(row.amount)), 0);
}

export async function appendCashMovement(tx: any, input: {
  kind: "capital_contribution" | "supplier_payment" | "sale_collection" | "expense" | "customer_refund" | "operator_remittance" | "withdrawal" | "profit_distribution" | "other" | "transfer";
  direction: "in" | "out";
  location: CashLocation;
  amountCents: number;
  method?: PaymentMethod;
  actorId: number;
  idempotencyKey: string;
  holderUserId?: number | null;
  deliveryId?: number | null;
  sourceType?: string | null;
  sourceId?: number | null;
  transferGroupId?: string | null;
  reference?: string | null;
  note?: string | null;
  occurredAt?: Date;
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Cash movement amount must be greater than zero." });
  await tx.insert(cashMovements).values({
    kind: input.kind,
    direction: input.direction,
    location: input.location,
    holderUserId: input.holderUserId ?? null,
    deliveryId: input.deliveryId ?? null,
    amountCents: input.amountCents,
    method: input.method ?? "cash",
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    transferGroupId: input.transferGroupId ?? null,
    idempotencyKey: input.idempotencyKey,
    reference: input.reference ?? null,
    note: input.note ?? null,
    occurredAt: input.occurredAt ?? new Date(),
    actorId: input.actorId,
  });
}

export async function saleBalance(q: any, saleId: number): Promise<{ balanceCents: number; creditedReturnsCents: number; collectionsCents: number; refundsCents: number }> {
  const [sale] = await q.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found." });
  const [returnTotal] = await q.select({ value: sql<number>`coalesce(sum(${salesReturns.creditCents}), 0)` })
    .from(salesReturns).where(eq(salesReturns.saleId, saleId));
  const payments = await q.select({ kind: collections.kind, amount: collections.amountCents })
    .from(collections).where(eq(collections.saleId, saleId));
  const creditedReturnsCents = Number(returnTotal?.value ?? 0);
  const collectionsCents = payments.filter((x: { kind: string }) => x.kind === "collection").reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0);
  const refundsCents = payments.filter((x: { kind: string }) => x.kind === "refund").reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0);
  return { balanceCents: Number(sale.totalCents) - creditedReturnsCents - collectionsCents + refundsCents, creditedReturnsCents, collectionsCents, refundsCents };
}
