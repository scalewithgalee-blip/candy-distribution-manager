# Candy Distribution Manager — Outcome checklist

Implementation outcomes and full acceptance criteria from the approved plan and user specification. Outcomes are marked complete only where supported by delivered behavior and validation evidence. Development/test fixtures must never be entered as live business records.

## 1. Independent application, authentication, permissions, and data isolation

- [x] Create a separate, responsive Candy Distribution Manager for the Philippines wholesale candy-distribution business. It must have its own database, authentication, records, and deployment configuration. Do not modify, overwrite, or share operational records with the existing cigarette application. Financial summaries must be calculated from recorded transactions, inventory movements, and payments rather than manually entered dashboard totals.
- [x] Provide an owner role with access to all financial and configuration records. Provide an operator role with only the operational permissions needed for assigned purchases, deliveries, stock movements, and collections. Restrict capital, profit distribution, investor settings, and sensitive financial reports to the owner. Use authentication and server-side permission checks; hiding buttons alone is not access control.
- [x] Do not grant ownership or operator access to an arbitrary first login. The project's initial owner OAuth identity is not configured: obtain the owner's Manus account email only through the protected WebDev secret input as `CANDY_OWNER_EMAIL`; never place its value in chat, source, Git, logs, or screenshots. Match only the configured value against the authenticated OAuth identity, fail closed while it is absent, and tie operator access to explicit owner authorization. Maintain timestamps and an audit trail for access/role changes.

## 2. Product catalog and pack inventory

- [x] Products include product ID and SKU; product name and variety; pack description; optional pieces per pack for reference only; active/inactive status; current weighted-average inventory cost per pack; default wholesale selling price per pack; and reorder threshold in packs. Sales use Pack as the default unit; do not use individual candy pieces as the default sales unit.
- [x] Record all inventory receipts, sales, customer returns, supplier returns, damaged stock, stock counts, and authorized adjustments. Maintain an auditable movement history, prevent negative stock, and do not delete completed movements. Corrections use a documented transaction reversal or adjustment workflow.
- [x] Inventory increases only when goods are received, not when a purchase order is created. Inventory costing uses weighted-average cost per product, including consistently allocated landed acquisition costs.

## 3. Purchases, receipts, supplier payments, and landed cost

- [x] Purchases include purchase ID; supplier and purchase date; sourcing/purchasing location (initially Divisoria, Philippines); products and quantities in packs; unit cost and line totals; allocated freight and other acquisition costs; total landed cost; amount paid and payment status; receipt reference and notes; and inventory receipt status.
- [x] Purchase-order creation does not increase inventory. Receiving stock records a receipt movement and computes landed cost. Actual supplier payments are recorded separately from purchase/receipt records. Acquisition costs are consistently allocated across received products and incorporated into weighted-average inventory costing. The business operator handles sourcing or receiving stock as assigned; an operator-entered purchase remains a draft proposal and may not be received or paid until the owner approves and assigns it.

## 4. Sales, store/customer accounts, collections, refunds, and returns

- [x] Sales include sale ID and date; store/customer; products and packs sold; actual selling price per pack; discounts and returns; gross invoice amount; amount collected and remaining balance; payment method and payment date; delivery status; operator responsible; notes and transaction status.
- [x] Support partial payments and outstanding receivables. Record money received separately from money earned. Prevent duplicate collection entries. Completed sales drive revenue; collections drive cash receipts. Support refunds, customer returns, and expense adjustments with linked, auditable records.
- [x] Customer returns link to their corresponding sale and record the movement, including whether returned packs are restockable or damaged. Do not silently erase or rewrite completed transactions; use reversals or adjustments.

## 5. Delivery and operator workflows

- [x] Record stock assigned for delivery, destination stores, completed deliveries, returned stock, collections, cash remitted, delivery expenses, shortages, and discrepancies. Link each delivery to its corresponding sales records. Maintain a clear outstanding-remittance balance.
- [x] Track the operator responsible for each relevant transaction and distinguish cash held by the operator from owner-held cash and money held in business accounts. Owner-only finance/capital access remains unavailable to operators. Permit operational work only for assigned and authorized tasks. The existing business operator handles sourcing or receiving stock, deliveries, and collections as assigned.

## 6. Cash ledger, locations, transfers, and reconciliation

- [x] Record capital contributions, supplier payments, sales collections, expenses, customer refunds, operator remittances, withdrawals, and other authorized cash movements. Distinguish cash held by the owner, cash held by the operator, and money held in business accounts.
- [x] Transfers between owner, operator, and business-account locations must not count as new revenue or new expenses. Report actual cash by location, operator-held cash, outstanding remittances, and cash reconciliation discrepancies from recorded movements; do not manually enter dashboard financial totals.
- [x] Record capital contributions and withdrawals separately from revenue and profit. Display distributions only when an actual distribution transaction is recorded.

## 7. Expenses, acquisition-cost treatment, and shared Hyundai H100

- [x] Expenses include date, category, amount, payment status, receipt, notes, and whether the expense is directly attributable to a purchase or to operations. Allow fuel, parking, delivery costs, supplies, and other legitimate business expenses to be tracked.
- [x] Support documented shared-vehicle cost allocation for the Hyundai H100 without double-counting expenses across businesses. Track the candy-business portion of relevant vehicle expenses, with a documented basis/reference. Costs allocated to purchases are treated consistently as acquisition costs; operating expenses reduce operating/net profit when appropriate.

## 8. Investor, capital, and authorized ownership

- [x] Gale is the initial sole investor. Record dated capital contributions and withdrawals separately from revenue and profit. The stated initial purchasing budget is PHP 25,000. Treat it as a stated business budget, not a dated contribution or actual cash balance unless an authorized, dated capital transaction is recorded.
- [x] Allow a future investor to be added without rewriting historical transactions. Ownership percentages must be explicit, effective-dated, and authorized. Do not assume an equal split or automatically assign Nikkie an ownership percentage; Nikkie is not an investor unless explicitly added through an authorized capital transaction and ownership agreement.
- [x] Restrict investor settings, capital transactions, ownership edits, and profit distributions to an owner; maintain an audit trail.

## 9. Profit, working capital, and reinvestment

- [x] Calculate revenue, cost of goods sold, gross profit, operating expenses, and net profit. Revenue is from completed sales; COGS is from inventory movements; profit is revenue less relevant costs and expenses. Use weighted-average inventory costing per product, including consistently allocated landed acquisition costs.
- [x] Separate net profit from cash on hand, inventory value, accounts receivable, capital, and retained earnings. Separate money received from money earned. Do not treat inventory purchases as immediate expenses when the stock remains unsold.
- [x] Never calculate available reinvestment by simply subtracting purchases and distributions from sales. Reconcile actual cash, receivables, inventory, liabilities, capital, and retained earnings to estimate working capital/reinvestment capacity. Show profit distributions only when an actual distribution transaction is recorded.
- [x] Support partial payments, refunds, returns, and expense adjustments. Correct errors through documented reversals/adjustments, with timestamps and an audit trail.

## 10. Dashboard and weekly reporting

- [x] Dashboard shows actual cash by location; inventory on hand at cost; total inventory packs; sales for the selected period; customer collections for the selected period; cost of goods sold; gross profit and net profit; operating expenses; accounts receivable; operator-held cash and outstanding remittances; initial capital and additional contributions; profit distributions; estimated working capital and reinvestment capacity; weekly sell-through rate; products requiring replenishment; and cash reconciliation discrepancies.
- [x] Clearly label all financial figures and selected date ranges. Reports distinguish revenue/earnings from cash collections, and label currency as PHP. Weekly turnover is approximately one week as a target to validate with actual sales data, not an assumed performance value.
- [x] Provide searchable records, date/product filters, and printable or exportable weekly reports.

## 11. Interface, navigation, and mobile use

- [x] Main navigation covers Dashboard; Products; Purchases; Sales and Store Accounts; Inventory; Deliveries and Operator; Cash Ledger; Expenses; Investor and Capital; Profit and Reinvestment; Weekly Reports; and Settings and Audit Log.
- [x] Create a clean, responsive interface for desktop and mobile. Adapt terminology and workflows for candy packs and retail-store deliveries. Prioritize fast transaction entry, clear financial summaries, searchable records, date/product filters, and printable/exportable reports.
- [x] Apply the supplied Corbel live-preview visual direction across every routed page without changing Candy business workflows: monochrome off-white/charcoal surfaces; horizontal primary route tabs; a floating dark icon dock that retains direct access to every module; high-contrast black key-metric and analytics cards; frosted white data panels; compact dense tables; and responsive mobile navigation. Do not copy the proprietary Corbel template source.
- [x] Provide transaction-specific, honest empty states. Do not use fabricated sample figures as real business records. Keep demo data clearly separated from production data.

## 12. Audit, validation, and truthful delivery

- [x] Maintain auditable movement history, timestamps, and a documented transaction reversal/adjustment workflow; never delete completed inventory movements. Financial summaries must originate from recorded transactions, movements and payments.
- [x] Before declaring the app ready, test purchase receipts, pack-level stock deductions, partial payments, customer returns, operator remittances, expense allocation, profit calculations, and cash reconciliation using known test transactions. Keep such test fixtures isolated; because development and production share the managed database, do not write test transactions into live business tables.
- [x] Deliver a functioning application, not just a static dashboard mockup. Report incomplete features and known limitations accurately. A preview, checkpoint or successful type/build check is not proof of successful publication or business-data transactions.

## Validation evidence

- [x] Managed MySQL migrations were applied additively; required business tables are present and all operational record tables were verified empty before handoff.
- [x] `pnpm check`, `pnpm test` (15 isolated finance/auth tests), `pnpm build`, route-manifest delivery, Preview root, and `/api/health` all succeeded.
- [x] Isolated test fixtures cover exact PHP-centavo arithmetic, landed-cost allocation, weighted-average costing, pack stock, partial receivables, returns, remittances, cash variance, reinvestment capacity, and expense-adjustment limits. No test transaction was written to the shared operational database.
- [x] The final interface uses the supplied CANDY logo in the utility dock/header, favicon, and project metadata, with the Corbel live-preview-inspired monochrome visual language applied through original project CSS and components.
