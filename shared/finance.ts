export function parseMoneyToCents(value: string | number): number {
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
    throw new Error(
      "Enter a non-negative amount with up to two decimal places."
    );
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents))
    throw new Error("Amount is outside the supported range.");
  return cents;
}

export function formatPHP(cents: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function roundRatio(
  value: number,
  numerator: number,
  denominator: number
): number {
  if (
    ![value, numerator, denominator].every(Number.isSafeInteger) ||
    value < 0 ||
    numerator < 0 ||
    denominator <= 0
  )
    throw new Error(
      "Ratio values must be non-negative safe integers with a positive denominator."
    );
  const product = BigInt(value) * BigInt(numerator);
  const divisor = BigInt(denominator);
  const quotient = product / divisor;
  const remainder = product % divisor;
  const rounded = Number(quotient + (remainder * 2n >= divisor ? 1n : 0n));
  if (!Number.isSafeInteger(rounded))
    throw new Error("Rounded ratio exceeds the supported range.");
  return rounded;
}

export function weightedAverageCostCents(
  currentPacks: number,
  currentAverageCents: number,
  receivedPacks: number,
  receivedLandedCents: number
): number {
  if (
    ![
      currentPacks,
      currentAverageCents,
      receivedPacks,
      receivedLandedCents,
    ].every(Number.isSafeInteger)
  )
    throw new Error(
      "Inventory costs and quantities must be whole, safe integers."
    );
  if (
    currentPacks < 0 ||
    receivedPacks <= 0 ||
    currentAverageCents < 0 ||
    receivedLandedCents < 0
  )
    throw new Error("Inventory quantities and costs are invalid.");
  const totalPacks = currentPacks + receivedPacks;
  if (!Number.isSafeInteger(totalPacks))
    throw new Error("Total inventory quantity exceeds the supported range.");
  const numerator =
    BigInt(currentPacks) * BigInt(currentAverageCents) +
    BigInt(receivedLandedCents);
  const denominator = BigInt(totalPacks);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = Number(quotient + (remainder * 2n >= denominator ? 1n : 0n));
  if (!Number.isSafeInteger(rounded))
    throw new Error("Weighted average cost exceeds the supported range.");
  return rounded;
}

export function allocateByValue(
  totalCents: number,
  weights: number[]
): number[] {
  if (
    !Number.isSafeInteger(totalCents) ||
    totalCents < 0 ||
    weights.some(weight => !Number.isSafeInteger(weight) || weight < 0)
  )
    throw new Error("Allocation values must be non-negative safe integers.");
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isSafeInteger(totalWeight))
    throw new Error("Allocation weight exceeds the supported range.");
  if (weights.length === 0) return [];
  if (totalWeight === 0) {
    const base = Math.floor(totalCents / weights.length);
    return weights.map(
      (_, index) => base + (index < totalCents % weights.length ? 1 : 0)
    );
  }
  const denominator = BigInt(totalWeight);
  const parts = weights.map((weight, index) => {
    const numerator = BigInt(totalCents) * BigInt(weight);
    const quotient = Number(numerator / denominator);
    const remainder = numerator % denominator;
    return { index, quotient, remainder };
  });
  const centsLeft =
    totalCents - parts.reduce((sum, part) => sum + part.quotient, 0);
  const remainderOrder = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1
  );
  const result = parts.map(part => part.quotient);
  for (let i = 0; i < centsLeft; i++) result[remainderOrder[i]!.index]! += 1;
  return result;
}

export function lineTotalCents(
  packs: number,
  unitPriceCents: number,
  discountCents: number
): number {
  if (
    ![packs, unitPriceCents, discountCents].every(Number.isSafeInteger) ||
    packs <= 0 ||
    unitPriceCents < 0 ||
    discountCents < 0
  )
    throw new Error("Quantity, price, or discount is invalid.");
  const gross = packs * unitPriceCents;
  if (!Number.isSafeInteger(gross) || discountCents > gross)
    throw new Error("Line discount cannot exceed its gross amount.");
  return gross - discountCents;
}

export function customerBalanceCents(
  invoiceCents: number,
  creditedReturnsCents: number,
  collectionsCents: number,
  refundsPaidCents: number
): number {
  return (
    invoiceCents - creditedReturnsCents - collectionsCents + refundsPaidCents
  );
}

export function remainingPackBalance(
  currentPacks: number,
  soldPacks: number,
  returnedPacks = 0
): number | null {
  const values = [currentPacks, soldPacks, returnedPacks];
  if (
    !values.every(value => Number.isSafeInteger(value) && value >= 0) ||
    soldPacks > currentPacks
  )
    return null;
  const remaining = currentPacks - soldPacks + returnedPacks;
  return Number.isSafeInteger(remaining) ? remaining : null;
}

export function deliveryShortagePacks(
  assignedPacks: number,
  deliveredPacks: number,
  returnedPacks: number
): number {
  if (
    ![assignedPacks, deliveredPacks, returnedPacks].every(
      Number.isSafeInteger
    ) ||
    assignedPacks <= 0 ||
    deliveredPacks < 0 ||
    returnedPacks < 0 ||
    deliveredPacks + returnedPacks > assignedPacks
  )
    throw new Error(
      "Delivered and returned packs must fit the positive delivery assignment."
    );
  return assignedPacks - deliveredPacks - returnedPacks;
}

export function remittanceOutstandingCents(
  collectionsCents: number,
  refundsCents: number,
  remittedCents: number,
  deliveryExpensesCents: number
): number {
  const values = [
    collectionsCents,
    refundsCents,
    remittedCents,
    deliveryExpensesCents,
  ];
  if (!values.every(value => Number.isSafeInteger(value) && value >= 0))
    throw new Error("Remittance totals must be non-negative safe integers.");
  return Math.max(
    0,
    collectionsCents - refundsCents - remittedCents - deliveryExpensesCents
  );
}

export function cashDifferenceCents(
  expectedCents: number,
  countedCents: number
): number {
  if (
    ![expectedCents, countedCents].every(
      value => Number.isSafeInteger(value) && value >= 0
    )
  )
    throw new Error(
      "Expected and counted cash must be non-negative safe integers."
    );
  return countedCents - expectedCents;
}

export function expenseAdjustmentAmountCents(
  currentAmountCents: number,
  deltaCents: number,
  cashPaidCents: number
): number | null {
  if (
    !Number.isSafeInteger(currentAmountCents) ||
    currentAmountCents < 0 ||
    !Number.isSafeInteger(deltaCents) ||
    !Number.isSafeInteger(cashPaidCents) ||
    cashPaidCents < 0
  )
    return null;
  const next = currentAmountCents + deltaCents;
  if (!Number.isSafeInteger(next) || next < cashPaidCents || next < 0)
    return null;
  return next;
}

export function reinvestmentCapacityCents(
  cashCents: number,
  receivablesCents: number,
  liabilitiesCents: number
): number {
  const values = [cashCents, receivablesCents, liabilitiesCents];
  if (!values.every(value => Number.isSafeInteger(value) && value >= 0))
    throw new Error("Reinvestment inputs must be non-negative safe integers.");
  const amount =
    BigInt(cashCents) + BigInt(receivablesCents) - BigInt(liabilitiesCents);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Reinvestment estimate exceeds the supported range.");
  return Math.max(0, Number(amount));
}

export function percentageBps(part: number, whole: number): number {
  if (
    !Number.isSafeInteger(part) ||
    !Number.isSafeInteger(whole) ||
    part < 0 ||
    whole <= 0
  )
    return 0;
  return roundRatio(part, 10000, whole);
}
