import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatPHP, parseMoneyToCents } from "@shared/finance";
import { startLogin } from "@/const";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Download,
  FileClock,
  FileText,
  Gem,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { Fragment, FormEvent, ReactNode, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type Icon = typeof LayoutDashboard;
type Any = any;
const nav = [
  {
    path: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    subtitle: "Business pulse",
  },
  {
    path: "/products",
    label: "Products",
    icon: Package,
    subtitle: "Catalog & pricing",
    owner: true,
  },
  {
    path: "/purchases",
    label: "Purchases",
    icon: ShoppingCart,
    subtitle: "Supplier receipts",
  },
  {
    path: "/sales",
    label: "Sales and Store Accounts",
    icon: Store,
    subtitle: "Invoices & collections",
  },
  {
    path: "/inventory",
    label: "Inventory",
    icon: Boxes,
    subtitle: "Packs on hand",
  },
  {
    path: "/deliveries",
    label: "Deliveries and Operator",
    icon: Truck,
    subtitle: "Route handoff",
  },
  {
    path: "/cash",
    label: "Cash Ledger",
    icon: WalletCards,
    subtitle: "Where cash sits",
  },
  {
    path: "/expenses",
    label: "Expenses",
    icon: CreditCard,
    subtitle: "Business costs",
  },
  {
    path: "/capital",
    label: "Investor and Capital",
    icon: Gem,
    subtitle: "Ownership & funding",
    owner: true,
  },
  {
    path: "/profit",
    label: "Profit and Reinvestment",
    icon: BarChart3,
    subtitle: "Margin & runway",
    owner: true,
  },
  {
    path: "/weekly-reports",
    label: "Weekly Reports",
    icon: FileText,
    subtitle: "Trading review",
    owner: true,
  },
  {
    path: "/settings",
    label: "Settings and Audit Log",
    icon: Settings2,
    subtitle: "Controls & trail",
    owner: true,
  },
] as const;
const today = new Date(),
  fromDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 30
  ),
  iso = (d: Date) => d.toISOString().slice(0, 10),
  dateAt = (s: string) => new Date(`${s}T00:00:00`),
  money = (v: unknown) => formatPHP(Number(v ?? 0)),
  num = (v: unknown) => new Intl.NumberFormat("en-PH").format(Number(v ?? 0)),
  dateLabel = (v: unknown) =>
    v
      ? new Intl.DateTimeFormat("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(String(v)))
      : "—",
  err = (e: unknown) =>
    e instanceof Error ? e.message : "Something went wrong. Try again.",
  locations = ["owner", "operator", "business_account"] as const;
const useApi = () => trpc.business as Any;
function Field({
  label,
  ...p
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="corbel-field people-field grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
      <span>{label}</span>
      <input
        {...p}
        className="corbel-control h-10 rounded-xl border border-[#deddea] bg-white px-3 text-sm font-normal tracking-normal text-[#202431] outline-none focus:border-[#202431] focus:ring-2 focus:ring-[#202431]/10"
      />
    </label>
  );
}
function SelectField({
  label,
  children,
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="corbel-field people-field grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
      <span>{label}</span>
      <select
        {...p}
        className="corbel-control h-10 rounded-xl border border-[#deddea] bg-white px-3 text-sm font-normal tracking-normal text-[#202431] outline-none focus:border-[#202431]"
      >
        {children}
      </select>
    </label>
  );
}
function Money({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <Field
      label={label}
      inputMode="decimal"
      placeholder="0.00"
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  );
}
function Button({
  children,
  variant = "primary",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "outline" | "danger";
}) {
  const s = {
    primary: "bg-[#1d1e22] text-white hover:bg-[#34363b]",
    quiet: "bg-[#edf8df] text-[#315d30]",
    outline: "border border-[#dfe3e8] bg-white text-[#4c515b]",
    danger: "bg-[#fff0ef] text-[#a24743]",
  };
  return (
    <button
      {...p}
      className={`corbel-button inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold disabled:opacity-50 ${s[variant]} ${p.className ?? ""}`}
    >
      {children}
    </button>
  );
}
function Frame({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="corbel-page people-page mx-auto max-w-[1480px]">
      <div className="people-page-header mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="people-page-kicker text-xs font-bold uppercase tracking-[.2em] text-[#8b919d]">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[-.04em] text-[#202431]">
            {title}
          </h1>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="corbel-table people-table overflow-x-auto rounded-2xl border border-[#e7e7f0] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#f7f7f7] text-[11px] uppercase tracking-[.16em] text-[#7c8498]">
          <tr>
            {headers.map(x => (
              <th key={x} className="whitespace-nowrap px-4 py-3 font-bold">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0e7df]">{children}</tbody>
      </table>
    </div>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="corbel-empty rounded-2xl border border-dashed border-[#d7d9ea] bg-[#fbfbff] px-6 py-12 text-center">
      <Archive className="mx-auto mb-3 text-[#9399ad]" size={26} />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[#758096]">{detail}</p>
    </div>
  );
}
function Pill({ value }: { value: unknown }) {
  return (
    <span className="people-status-pill inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize">
      {String(value ?? "—").replaceAll("_", " ")}
    </span>
  );
}
function Loading() {
  return (
    <div className="corbel-loading flex items-center gap-2 rounded-2xl border border-[#e7e7f0] bg-white px-5 py-10 text-sm text-[#758096]">
      <RefreshCw size={16} className="animate-spin" />
      Loading business data…
    </div>
  );
}
function Restricted() {
  return (
    <div className="corbel-restricted rounded-2xl border border-[#e7e7f0] bg-white p-8 text-center">
      <BriefcaseBusiness className="mx-auto mb-3 text-[#6c5ce7]" size={28} />
      <h2 className="font-black">Owner access required</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#758096]">
        This section is hidden from operators and protected by the server.
      </p>
    </div>
  );
}
function Kpi({
  label,
  value,
  note,
  accent = "berry",
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
}) {
  return (
    <div className="corbel-kpi people-kpi-card relative overflow-hidden rounded-2xl border border-[#e7e7f0] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7c8498]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black">{value}</p>
      {note && <p className="mt-1 text-xs text-[#8b93a6]">{note}</p>}
    </div>
  );
}
function DateFilter({ from, to, setFrom, setTo }: Any) {
  return (
    <div className="corbel-date-filter people-date-filter flex flex-wrap items-end gap-2 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-3">
      <div className="w-36">
        <Field
          label="From"
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
        />
      </div>
      <div className="w-36">
        <Field
          label="To"
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
        />
      </div>
      <span className="mb-2 text-xs text-[#8b93a6]">Filtered period</span>
    </div>
  );
}
function Holder({
  role,
  operators,
  value,
  setValue,
}: {
  role: string;
  operators: Any[];
  value: string;
  setValue: (v: string) => void;
}) {
  return role === "operator" ? (
    <p className="rounded-xl bg-[#eeecff] px-3 py-2 text-xs text-[#6c5ce7]">
      Cash holder: your operator account (required)
    </p>
  ) : (
    <SelectField
      label="Authorized operator holder *"
      value={value}
      onChange={e => setValue(e.target.value)}
    >
      <option value="">Select holder — never assumed</option>
      {operators.map(x => (
        <option key={x.id} value={x.id}>
          {x.name || x.email}
        </option>
      ))}
    </SelectField>
  );
}
function Products({ owner }: Any) {
  const [show, setShow] = useState(false),
    [edit, setEdit] = useState<Any>(null),
    [search, setSearch] = useState(""),
    [f, setF] = useState<Any>({ reorder: "10" });
  const api = useApi(),
    q = api.products.list.useQuery({
      activeOnly: false,
      search: search.trim() || undefined,
    }),
    u = trpc.useUtils(),
    create = api.products.create.useMutation({
      onSuccess: () => {
        toast.success("Product added");
        setShow(false);
        setF({ reorder: "10" });
        void u.business.products.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    update = api.products.update.useMutation({
      onSuccess: () => {
        toast.success("Product updated");
        setEdit(null);
        void u.business.products.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    });
  if (!owner) return <Restricted />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const v = edit || f;
      if (!v.sku?.trim() || !v.name?.trim() || !v.packDescription?.trim())
        throw Error("SKU, name and pack description are required.");
      const price = parseMoneyToCents(v.price || "0"),
        reorder = Number(v.reorder || 0);
      if (price < 0 || !Number.isInteger(reorder) || reorder < 0)
        throw Error("Enter a valid non-negative price and reorder threshold.");
      const payload = {
        sku: v.sku.trim(),
        name: v.name.trim(),
        variety: v.variety?.trim() || undefined,
        packDescription: v.packDescription.trim(),
        piecesPerPack: v.pieces ? Number(v.pieces) : undefined,
        defaultPriceCents: price,
        reorderPacks: reorder,
      };
      if (edit)
        update.mutate({ id: edit.id, ...payload, active: Boolean(v.active) });
      else create.mutate(payload);
    } catch (x) {
      toast.error(err(x));
    }
  };
  const openEdit = (p: Any) =>
    setEdit({
      id: p.id,
      sku: p.sku,
      name: p.name,
      variety: p.variety || "",
      packDescription: p.packDescription,
      pieces: p.piecesPerPack ?? "",
      price: String(Number(p.defaultPriceCents) / 100),
      reorder: String(p.reorderPacks ?? 0),
      active: Boolean(p.active),
    });
  const editor = show || edit;
  const value = edit || f;
  const setValue = (key: string, value: Any) =>
    edit ? setEdit({ ...edit, [key]: value }) : setF({ ...f, [key]: value });
  return (
    <Frame
      title="Products"
      eyebrow="Catalog"
      action={
        <Button
          onClick={() => {
            setShow(!show);
            setEdit(null);
          }}
        >
          <Plus size={16} />
          New product
        </Button>
      }
    >
      {editor && (
        <form
          onSubmit={submit}
          className="mb-5 grid gap-3 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4 md:grid-cols-4"
        >
          <Field
            label="SKU *"
            value={value.sku || ""}
            onChange={e => setValue("sku", e.target.value)}
          />
          <Field
            label="Product name *"
            value={value.name || ""}
            onChange={e => setValue("name", e.target.value)}
          />
          <Field
            label="Variety"
            value={value.variety || ""}
            onChange={e => setValue("variety", e.target.value)}
          />
          <Field
            label="Pack description *"
            placeholder="24 x 20g"
            value={value.packDescription || ""}
            onChange={e => setValue("packDescription", e.target.value)}
          />
          <Field
            label="Pieces / pack"
            type="number"
            min="1"
            value={value.pieces || ""}
            onChange={e => setValue("pieces", e.target.value)}
          />
          <Money
            label="Default wholesale price (PHP) *"
            value={value.price || ""}
            setValue={v => setValue("price", v)}
          />
          <Field
            label="Reorder threshold (packs)"
            type="number"
            min="0"
            value={value.reorder ?? ""}
            onChange={e => setValue("reorder", e.target.value)}
          />
          {edit && (
            <SelectField
              label="Status"
              value={value.active ? "active" : "inactive"}
              onChange={e => setValue("active", e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectField>
          )}
          <div className="flex items-end gap-2">
            <Button type="submit">
              {edit ? "Save changes" : "Save product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShow(false);
                setEdit(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      <div className="mb-5 max-w-md">
        <Field
          label="Search catalog"
          placeholder="SKU, product name, or variety"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <Table
          headers={[
            "SKU",
            "Product",
            "Pack units",
            "On hand",
            "Price",
            "Status",
            "Action",
          ]}
        >
          {q.data.map((p: Any) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
              <td className="px-4 py-3 font-semibold">
                {p.name}
                <div className="text-xs font-normal text-[#8b93a6]">
                  {p.variety || "Unspecified"}
                </div>
              </td>
              <td className="px-4 py-3">{p.packDescription}</td>
              <td className="px-4 py-3 font-bold">{num(p.stockPacks)} packs</td>
              <td className="px-4 py-3">{money(p.defaultPriceCents)}</td>
              <td className="px-4 py-3">
                <Pill value={p.active ? "active" : "inactive"} />
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShow(false);
                    openEdit(p);
                  }}
                >
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty
          title="No products yet"
          detail="Add a real candy pack to begin. No sample records are created."
        />
      )}
    </Frame>
  );
}
function Dashboard({
  owner,
  data,
  operations,
  salesRows,
  from,
  to,
  setFrom,
  setTo,
}: Any) {
  if (!owner)
    return (
      <Frame title="Dashboard" eyebrow="Operator workspace">
        <div className="reference-card-grid reference-card-grid-three">
          <div className="reference-stat-card">
            <span className="reference-stat-label">ASSIGNED DELIVERIES</span>
            <strong>{num(operations?.assignedDeliveryCount)}</strong>
            <span>Ready for route work</span>
          </div>
          <div className="reference-stat-card">
            <span className="reference-stat-label">LOW STOCK ALERTS</span>
            <strong>{num(operations?.lowStock?.length)}</strong>
            <span>Restock signals</span>
          </div>
          <div className="reference-stat-card">
            <span className="reference-stat-label">ACCESS SCOPE</span>
            <strong>Operator</strong>
            <span>Owner reports hidden</span>
          </div>
        </div>
      </Frame>
    );

  const period = data?.period ?? {},
    position = data?.position ?? {},
    rangeDays = Math.max(
      1,
      Math.round(
        (new Date(`${to}T00:00:00`).getTime() -
          new Date(`${from}T00:00:00`).getTime()) /
          86400000
      ) + 1
    ),
    rows = Array.isArray(salesRows) ? salesRows : [],
    soldPacks = Number(period.soldPacks ?? 0),
    inventoryPacks = Number(position.inventoryPacks ?? 0),
    revenueCents = Number(period.revenueCents ?? 0),
    collectionsCents = Number(period.collectionsCents ?? 0),
    collectionRate = revenueCents
      ? Math.min(100, (collectionsCents / revenueCents) * 100)
      : 0,
    velocity = soldPacks / rangeDays,
    sellThrough = Math.min(100, Number(period.sellThroughBps ?? 0) / 100),
    dateRange = `${dateLabel(from)} – ${dateLabel(to)}`,
    selectedRange = rangeDays <= 8 ? "7" : rangeDays <= 31 ? "30" : "90",
    daily = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(`${to}T00:00:00`);
      day.setDate(day.getDate() - (6 - index));
      const key = iso(day);
      const dayRows = rows.filter(
        (sale: Any) => iso(new Date(String(sale.saleDate))) === key
      );
      return {
        key,
        label: new Intl.DateTimeFormat("en-PH", { weekday: "short" })
          .format(day)
          .slice(0, 1),
        orders: dayRows.length,
        revenueCents: dayRows.reduce(
          (sum: number, sale: Any) => sum + Number(sale.totalCents ?? 0),
          0
        ),
        collectionsCents: dayRows.reduce(
          (sum: number, sale: Any) => sum + Number(sale.collectionsCents ?? 0),
          0
        ),
        packs: dayRows.reduce(
          (sum: number, sale: Any) =>
            sum +
            (sale.lines ?? []).reduce(
              (lineSum: number, line: Any) => lineSum + Number(line.packs ?? 0),
              0
            ),
          0
        ),
      };
    }),
    maxRevenue = Math.max(1, ...daily.map(day => day.revenueCents)),
    cashCents = Number(position.cashTotalCents ?? 0),
    inventoryValueCents = Number(position.inventoryValueCents ?? 0),
    receivablesCents = Number(position.accountsReceivableCents ?? 0),
    positionTotal = Math.max(
      1,
      cashCents + inventoryValueCents + receivablesCents
    ),
    cashShare = (cashCents / positionTotal) * 100,
    inventoryShare = (inventoryValueCents / positionTotal) * 100,
    activityRows = [
      { label: "Invoices", values: daily.map(day => day.orders) },
      { label: "Packs", values: daily.map(day => day.packs) },
      { label: "Cash", values: daily.map(day => day.collectionsCents) },
      { label: "Sales", values: daily.map(day => day.revenueCents) },
    ];

  return (
    <div className="reference-dashboard corbel-dashboard">
      <div className="corbel-dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <div
            className="corbel-dashboard-tabs"
            role="tablist"
            aria-label="Dashboard views"
          >
            <button
              className="corbel-dashboard-tab corbel-dashboard-tab-active"
              role="tab"
              aria-selected="true"
            >
              Overview
            </button>
            <Link className="corbel-dashboard-tab" href="/cash">
              Money
            </Link>
            <Link className="corbel-dashboard-tab" href="/inventory">
              Inventory
            </Link>
          </div>
        </div>
        <div className="corbel-dashboard-meta">
          <span>◷ {dateRange}</span>
          <div className="reference-action-row">
            <Link href="/weekly-reports" className="reference-secondary-action">
              ⌁ Full analytics
            </Link>
            <Link href="/weekly-reports" className="reference-primary-action">
              ↓ Export
            </Link>
          </div>
        </div>
      </div>

      <div className="corbel-kpi-grid">
        <article className="corbel-kpi-card corbel-kpi-dark">
          <div className="corbel-kpi-label">
            ACTIVE SALES <span>ⓘ</span>
          </div>
          <strong>{money(revenueCents)}</strong>
          <div className="corbel-kpi-trend">
            ↑ {num(period.salesCount)} invoices · selected range
          </div>
          <Link href="/sales">
            See sales <span>↗</span>
          </Link>
          <div className="corbel-kpi-bars">
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="corbel-kpi-card">
          <div className="corbel-kpi-label">
            CASH COLLECTED <span>ⓘ</span>
          </div>
          <strong>{money(collectionsCents)}</strong>
          <div className="corbel-kpi-trend">
            {collectionRate.toFixed(1)}% of recorded sales
          </div>
          <Link href="/cash">
            See cash ledger <span>↗</span>
          </Link>
          <svg
            className="corbel-kpi-spark"
            viewBox="0 0 92 34"
            aria-label="Collections trend"
          >
            <polyline points="2,28 18,24 31,27 45,12 59,18 74,7 90,11" />
          </svg>
        </article>
        <article className="corbel-kpi-card corbel-kpi-soft">
          <div className="corbel-kpi-label">
            PACKS SOLD <span>ⓘ</span>
          </div>
          <strong>{num(soldPacks)}</strong>
          <div className="corbel-kpi-trend">
            {velocity
              ? `${velocity.toFixed(1)} packs/day`
              : "No sales velocity yet"}
          </div>
          <Link href="/inventory">
            See inventory <span>↗</span>
          </Link>
          <div
            className="corbel-kpi-ring"
            style={{
              background: `conic-gradient(#10110f 0 ${sellThrough}%, #c7c7c1 ${sellThrough}% 100%)`,
            }}
          >
            <span>{Math.round(sellThrough)}%</span>
          </div>
        </article>
        <article className="corbel-kpi-card corbel-kpi-soft">
          <div className="corbel-kpi-label">
            COLLECTION RATE <span>ⓘ</span>
          </div>
          <strong>{collectionRate.toFixed(1)}%</strong>
          <div className="corbel-kpi-trend">
            {money(position.accountsReceivableCents)} remains receivable
          </div>
          <Link href="/sales">
            See accounts <span>↗</span>
          </Link>
          <div className="corbel-kpi-mini-bars">
            {daily.map(day => (
              <i
                key={day.key}
                style={{
                  height: `${day.revenueCents ? Math.max(12, (day.collectionsCents / Math.max(1, day.revenueCents)) * 100) : 8}%`,
                }}
              />
            ))}
          </div>
        </article>
      </div>

      <div className="corbel-main-analytics">
        <section className="corbel-performance-panel">
          <div className="corbel-panel-title">
            SALES PERFORMANCE <span>ⓘ</span>
          </div>
          <div
            className="corbel-gauge"
            style={{
              background: `conic-gradient(from 270deg, #fff 0 ${sellThrough * 1.35}deg, #3a3a36 ${sellThrough * 1.35}deg 270deg, transparent 270deg)`,
            }}
          >
            <div>
              <strong>{Math.round(sellThrough)}</strong>
              <span>
                of 100
                <br />
                points
              </span>
            </div>
          </div>
          <strong className="corbel-performance-status">
            {sellThrough >= 70 ? "Ahead of plan" : "Building momentum"}
          </strong>
          <p>
            {rows.length
              ? `Recorded sales are moving at ${velocity.toFixed(1)} packs per day.`
              : "Record sales to build a live performance score."}
          </p>
          <Link href="/weekly-reports">Improve your score</Link>
        </section>

        <section className="corbel-revenue-panel">
          <div className="corbel-panel-header">
            <div>
              <span className="corbel-panel-title">
                REVENUE <span>ⓘ</span>
              </span>
              <strong>{money(revenueCents)}</strong>
              <small> in selected period</small>
            </div>
            <select
              className="reference-period-select"
              value={selectedRange}
              onChange={e => {
                const days = Number(e.target.value);
                setFrom(iso(new Date(Date.now() - (days - 1) * 86400000)));
                setTo(iso(today));
              }}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <div className="corbel-revenue-chart">
            <div className="corbel-chart-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
            {daily.map(day => (
              <div className="corbel-revenue-column" key={day.key}>
                <span>{day.revenueCents ? money(day.revenueCents) : ""}</span>
                <i
                  style={{
                    height: `${day.revenueCents ? Math.max(7, (day.revenueCents / maxRevenue) * 100) : 0}%`,
                  }}
                />
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="corbel-bottom-analytics">
        <section className="corbel-activity-panel">
          <div className="corbel-panel-header">
            <div>
              <span className="corbel-panel-title">
                SALES ACTIVITY <span>ⓘ</span>
              </span>
              <strong>Daily movement</strong>
            </div>
            <span className="corbel-activity-legend">
              low <i />
              <i />
              <i />
              <i /> high
            </span>
          </div>
          <div className="corbel-activity-grid">
            <div />
            {daily.map(day => (
              <span key={day.key}>{day.label}</span>
            ))}
            {activityRows.map(row => {
              const max = Math.max(1, ...row.values);
              return (
                <Fragment key={row.label}>
                  <label>{row.label}</label>
                  {row.values.map((value, index) => (
                    <i
                      key={`${row.label}-${daily[index].key}`}
                      style={{
                        opacity: value ? 0.25 + (value / max) * 0.75 : 0.12,
                      }}
                      aria-label={`${row.label} ${daily[index].label}: ${value}`}
                    />
                  ))}
                </Fragment>
              );
            })}
          </div>
        </section>
        <section className="corbel-position-panel">
          <div className="corbel-panel-header">
            <div>
              <span className="corbel-panel-title">
                BUSINESS POSITION <span>ⓘ</span>
              </span>
              <strong>Working capital mix</strong>
            </div>
            <Link href="/profit">View report ↗</Link>
          </div>
          <div className="corbel-position-content">
            <div
              className="corbel-position-donut"
              style={{
                background: `conic-gradient(#10110f 0 ${cashShare}%, #777771 ${cashShare}% ${cashShare + inventoryShare}%, #d1d1cb ${cashShare + inventoryShare}% 100%)`,
              }}
            >
              <div>
                <strong>{money(position.workingCapitalCents)}</strong>
                <span>working capital</span>
              </div>
            </div>
            <div className="corbel-position-legend">
              <div>
                <i className="corbel-dot-dark" />
                <span>Cash</span>
                <strong>{money(cashCents)}</strong>
              </div>
              <div>
                <i className="corbel-dot-mid" />
                <span>Inventory</span>
                <strong>{money(inventoryValueCents)}</strong>
              </div>
              <div>
                <i className="corbel-dot-light" />
                <span>Receivables</span>
                <strong>{money(receivablesCents)}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="reference-panel peopledesk-table-panel corbel-recent-panel">
        <div className="reference-panel-heading">
          <div>
            <p className="reference-panel-kicker">OPERATIONS</p>
            <h2>Recent sales</h2>
            <p>Latest completed invoices in the selected range</p>
          </div>
          <Link href="/sales" className="reference-secondary-action">
            View all sales
          </Link>
        </div>
        <div className="mt-4">
          <Table
            headers={[
              "Date",
              "Store",
              "Packs",
              "Invoice",
              "Collected",
              "Status",
              "Action",
            ]}
          >
            {rows.length ? (
              rows.slice(0, 6).map((sale: Any) => {
                const packs = (sale.lines ?? []).reduce(
                  (sum: number, line: Any) => sum + Number(line.packs ?? 0),
                  0
                );
                return (
                  <tr key={sale.id}>
                    <td className="px-4 py-3 text-[#6e747d]">
                      {dateLabel(sale.saleDate)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {sale.storeName}
                    </td>
                    <td className="px-4 py-3">{num(packs)} packs</td>
                    <td className="px-4 py-3 font-semibold">
                      {money(sale.totalCents)}
                    </td>
                    <td className="px-4 py-3">
                      {money(sale.collectionsCents)}
                    </td>
                    <td className="px-4 py-3">
                      <Pill value={sale.deliveryStatus ?? "completed"} />
                    </td>
                    <td className="px-4 py-3 text-[#9aa0a8]">···</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[#9aa0a8]"
                >
                  No completed sales in this period.
                </td>
              </tr>
            )}
          </Table>
        </div>
      </section>
    </div>
  );
}
function Purchases({ products, role, userId, operators }: Any) {
  const owner = role === "owner",
    api = useApi(),
    u = trpc.useUtils(),
    defaultLocation = "Divisoria, Philippines";
  const [show, setShow] = useState(false),
    [assignments, setAssignments] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(iso(fromDate)),
    [to, setTo] = useState(iso(today)),
    [payForm, setPayForm] = useState<Any>(null);
  const [f, setF] = useState<Any>({
    supplier: "",
    source: "",
    purchaseDate: iso(new Date()),
    acquisition: "",
    notes: "",
    reference: "",
    lines: [{ product: "", packs: "1", cost: "" }],
    receive: false,
    paid: "",
    paymentMethod: "cash",
    cashLocation: "owner",
    operator: "",
  });
  const q = api.purchases.list.useQuery({
      search: search.trim() || undefined,
      from: dateAt(from),
      to: new Date(`${to}T23:59:59`),
    }),
    settings = api.settings.get.useQuery(undefined, { enabled: owner });
  const create = api.purchases.create.useMutation({
    onSuccess: () => {
      toast.success(
        owner ? "Purchase recorded" : "Purchase proposal submitted"
      );
      setShow(false);
      void u.business.purchases.list.invalidate();
      void u.business.inventory.list.invalidate();
      void u.business.cash.list.invalidate();
    },
    onError: (e: Any) => toast.error(err(e)),
  });
  const approve = api.purchases.approve.useMutation({
    onSuccess: () => {
      toast.success("Purchase approved and assigned");
      void u.business.purchases.list.invalidate();
    },
    onError: (e: Any) => toast.error(err(e)),
  });
  const receive = api.purchases.receive.useMutation({
    onSuccess: () => {
      toast.success("Purchase received; stock posted");
      void u.business.purchases.list.invalidate();
      void u.business.inventory.list.invalidate();
    },
    onError: (e: Any) => toast.error(err(e)),
  });
  const pay = api.purchases.pay.useMutation({
    onSuccess: () => {
      toast.success("Supplier payment recorded");
      setPayForm(null);
      void u.business.purchases.list.invalidate();
      void u.business.cash.list.invalidate();
    },
    onError: (e: Any) => toast.error(err(e)),
  });
  const setLine = (index: number, key: string, value: string) =>
    setF((prev: Any) => ({
      ...prev,
      lines: prev.lines.map((line: Any, i: number) =>
        i === index ? { ...line, [key]: value } : line
      ),
    }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!f.supplier?.trim()) throw Error("Supplier is required.");
      const lines = (f.lines ?? []).map((line: Any) => ({
        productId: Number(line.product),
        packs: Number(line.packs),
        unitCostCents: parseMoneyToCents(line.cost || "0"),
      }));
      if (
        !lines.length ||
        lines.some(
          (line: Any) =>
            !line.productId || line.packs <= 0 || line.unitCostCents < 0
        )
      )
        throw Error(
          "Add at least one product line with packs and a valid unit cost."
        );
      const paidCents = owner ? parseMoneyToCents(f.paid || "0") : 0;
      if (
        owner &&
        paidCents > 0 &&
        f.cashLocation === "operator" &&
        !f.operator
      )
        throw Error("Select the authorized operator who holds this cash.");
      if (
        owner &&
        (Boolean(f.receive) || paidCents > 0) &&
        !window.confirm(
          "Post the selected stock receipt and/or supplier cash movement?"
        )
      )
        return;
      create.mutate({
        idempotencyKey: crypto.randomUUID(),
        supplierName: f.supplier.trim(),
        sourceLocation: (
          f.source ||
          settings.data?.purchasingLocation ||
          defaultLocation
        ).trim(),
        purchaseDate: dateAt(f.purchaseDate || iso(new Date())),
        acquisitionCostsCents: parseMoneyToCents(f.acquisition || "0"),
        receiptRef: f.reference?.trim() || undefined,
        notes: f.notes?.trim() || undefined,
        operatorId: owner && f.operator ? Number(f.operator) : undefined,
        receiveNow: owner && Boolean(f.receive),
        paidNowCents: paidCents,
        paymentMethod: f.paymentMethod || "cash",
        cashLocation:
          owner && paidCents > 0 ? f.cashLocation || "owner" : undefined,
        lines,
      });
    } catch (x) {
      toast.error(err(x));
    }
  };
  const submitPayment = () => {
    try {
      if (!payForm) return;
      const amount = parseMoneyToCents(payForm.amount || "0");
      if (amount <= 0) throw Error("Enter a payment amount greater than zero.");
      if (owner && payForm.cashLocation === "operator" && !payForm.holder)
        throw Error("Select the authorized operator cash holder.");
      if (!window.confirm("Record this supplier cash payment?")) return;
      pay.mutate({
        purchaseId: Number(payForm.id),
        amountCents: amount,
        method: payForm.method || "cash",
        cashLocation: owner ? payForm.cashLocation || "owner" : "operator",
        holderUserId:
          owner && payForm.cashLocation === "operator"
            ? Number(payForm.holder)
            : role === "operator"
              ? userId
              : undefined,
        reference: payForm.reference?.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
        paidAt: new Date(),
      });
    } catch (x) {
      toast.error(err(x));
    }
  };
  return (
    <Frame
      title="Purchases"
      eyebrow="Supplier receipts"
      action={
        <Button onClick={() => setShow(!show)}>
          <Plus size={16} />
          {owner ? "Record purchase" : "Propose purchase"}
        </Button>
      }
    >
      <DateFilter {...{ from, to, setFrom, setTo }} />
      <div className="mb-5 mt-5 max-w-md">
        <Field
          label="Search purchases"
          placeholder="Purchase number or supplier"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {show && (
        <form
          onSubmit={submit}
          className="mb-5 grid gap-4 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4 md:grid-cols-4"
        >
          <Field
            label="Supplier *"
            value={f.supplier}
            onChange={e => setF({ ...f, supplier: e.target.value })}
          />
          <Field
            label="Source location"
            placeholder={settings.data?.purchasingLocation || defaultLocation}
            value={f.source}
            onChange={e => setF({ ...f, source: e.target.value })}
          />
          <Field
            label="Purchase date *"
            type="date"
            value={f.purchaseDate}
            onChange={e => setF({ ...f, purchaseDate: e.target.value })}
          />
          <Money
            label="Acquisition costs (PHP)"
            value={f.acquisition}
            setValue={v => setF({ ...f, acquisition: v })}
          />
          <div className="md:col-span-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
                Product pack lines *
              </p>
              <Button
                type="button"
                variant="quiet"
                onClick={() =>
                  setF((prev: Any) => ({
                    ...prev,
                    lines: [
                      ...prev.lines,
                      { product: "", packs: "1", cost: "" },
                    ],
                  }))
                }
              >
                <Plus size={14} />
                Add line
              </Button>
            </div>
            <div className="space-y-2">
              {(f.lines ?? []).map((line: Any, index: number) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_160px_auto]"
                >
                  <SelectField
                    label={`Product ${index + 1}`}
                    value={line.product}
                    onChange={e => setLine(index, "product", e.target.value)}
                  >
                    <option value="">Choose product</option>
                    {products.map((p: Any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.packDescription}
                      </option>
                    ))}
                  </SelectField>
                  <Field
                    label="Packs"
                    type="number"
                    min="1"
                    value={line.packs}
                    onChange={e => setLine(index, "packs", e.target.value)}
                  />
                  <Money
                    label="Unit cost (PHP)"
                    value={line.cost}
                    setValue={v => setLine(index, "cost", v)}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    className="self-end"
                    disabled={f.lines.length === 1}
                    onClick={() =>
                      setF((prev: Any) => ({
                        ...prev,
                        lines: prev.lines.filter(
                          (_: Any, i: number) => i !== index
                        ),
                      }))
                    }
                  >
                    <X size={15} />
                    <span className="sm:hidden">Remove</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Field
            label="Reference / receipt no."
            value={f.reference}
            onChange={e => setF({ ...f, reference: e.target.value })}
          />
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096] md:col-span-3">
            <span>Notes</span>
            <textarea
              className="min-h-10 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431] outline-none focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/15"
              value={f.notes}
              onChange={e => setF({ ...f, notes: e.target.value })}
            />
          </label>
          {owner && (
            <>
              <SelectField
                label="Assign operator (optional)"
                value={f.operator}
                onChange={e => setF({ ...f, operator: e.target.value })}
              >
                <option value="">No assignment</option>
                {operators.map((o: Any) => (
                  <option key={o.id} value={o.id}>
                    {o.name || o.email}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Payment method"
                value={f.paymentMethod}
                onChange={e => setF({ ...f, paymentMethod: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="e_wallet">E-wallet</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </SelectField>
              <SelectField
                label="Cash location"
                value={f.cashLocation}
                onChange={e => setF({ ...f, cashLocation: e.target.value })}
              >
                <option value="owner">Owner-held cash</option>
                <option value="business_account">Business account</option>
                <option value="operator">Operator-held cash</option>
              </SelectField>
              <Money
                label="Pay now (PHP)"
                value={f.paid}
                setValue={v => setF({ ...f, paid: v })}
              />
              {f.cashLocation === "operator" && (
                <p className="rounded-xl bg-[#eeecff] px-3 py-2 text-xs text-[#6c5ce7]">
                  Cash holder: the assigned operator above (required for
                  operator-held cash).
                </p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(f.receive)}
                  onChange={e => setF({ ...f, receive: e.target.checked })}
                />
                Receive stock now
              </label>
            </>
          )}
          <div className="flex items-end">
            <Button type="submit">
              {owner ? "Save purchase" : "Submit proposal"}
            </Button>
          </div>
        </form>
      )}
      {payForm && (
        <div className="mb-5 rounded-2xl border border-[#e7e7f0] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#f0a34b]">
                Supplier payment
              </p>
              <h3 className="font-black">
                Post cash against {payForm.purchaseNo}
              </h3>
            </div>
            <Button
              type="button"
              variant="quiet"
              onClick={() => setPayForm(null)}
            >
              <X size={15} />
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Money
              label={`Amount due ${money(payForm.balanceCents)}`}
              value={payForm.amount}
              setValue={v => setPayForm({ ...payForm, amount: v })}
            />
            <SelectField
              label="Payment method"
              value={payForm.method}
              onChange={e => setPayForm({ ...payForm, method: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="e_wallet">E-wallet</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </SelectField>
            {owner && (
              <SelectField
                label="Cash location"
                value={payForm.cashLocation}
                onChange={e =>
                  setPayForm({
                    ...payForm,
                    cashLocation: e.target.value,
                    holder: "",
                  })
                }
              >
                <option value="owner">Owner-held cash</option>
                <option value="business_account">Business account</option>
                <option value="operator">Operator-held cash</option>
              </SelectField>
            )}
            {owner && payForm.cashLocation === "operator" ? (
              <Holder
                role={role}
                operators={operators}
                value={payForm.holder}
                setValue={v => setPayForm({ ...payForm, holder: v })}
              />
            ) : (
              !owner && (
                <p className="rounded-xl bg-[#eeecff] px-3 py-2 text-xs text-[#6c5ce7]">
                  Cash holder: your operator account.
                </p>
              )
            )}
            <Field
              label="Payment reference"
              value={payForm.reference}
              onChange={e =>
                setPayForm({ ...payForm, reference: e.target.value })
              }
            />
            <div className="flex items-end gap-2">
              <Button type="button" onClick={submitPayment}>
                Post payment
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayForm(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <Table
          headers={
            owner
              ? [
                  "Purchase",
                  "Supplier / date",
                  "Source",
                  "Approval",
                  "Landed cost",
                  "Balance due",
                  "Payment",
                  "Stock",
                  "Actions",
                ]
              : [
                  "Purchase",
                  "Supplier / date",
                  "Source",
                  "Approval",
                  "Stock",
                  "Actions",
                ]
          }
        >
          {q.data.map((p: Any) => {
            const approved = Boolean(p.ownerApprovedAt),
              assignedToMe = Number(p.operatorId) === Number(userId),
              canPost = approved && (owner || assignedToMe);
            return (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs font-bold">
                  {p.purchaseNo}
                  <div className="mt-1 text-[10px] font-sans font-normal text-[#8b93a6]">
                    #{p.id}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {p.supplierName}
                  <div className="text-xs font-normal text-[#8b93a6]">
                    {dateLabel(p.purchaseDate)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {p.sourceLocation || defaultLocation}
                </td>
                <td className="px-4 py-3">
                  <Pill
                    value={
                      approved
                        ? "approved · assigned"
                        : "awaiting owner approval"
                    }
                  />
                  {p.operatorId && (
                    <div className="mt-1 text-xs text-[#8b93a6]">
                      Operator #{p.operatorId}
                    </div>
                  )}
                </td>
                {owner && (
                  <>
                    <td className="px-4 py-3 font-semibold">
                      {money(
                        p.landedCostCents ??
                          Number(p.subtotalCents) +
                            Number(p.acquisitionCostsCents)
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {money(p.balanceCents)}
                    </td>
                    <td className="px-4 py-3">
                      <Pill value={p.paymentStatus} />
                    </td>
                  </>
                )}
                <td className="px-4 py-3">
                  <Pill value={p.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-[190px] flex-wrap gap-2">
                    {owner && !approved && p.status === "draft" && (
                      <>
                        <SelectField
                          label="Assign"
                          value={assignments[p.id] || ""}
                          onChange={e =>
                            setAssignments({
                              ...assignments,
                              [p.id]: e.target.value,
                            })
                          }
                        >
                          <option value="">Choose operator</option>
                          {operators.map((o: Any) => (
                            <option key={o.id} value={o.id}>
                              {o.name || o.email}
                            </option>
                          ))}
                        </SelectField>
                        <Button
                          variant="quiet"
                          onClick={() => {
                            if (!assignments[p.id]) {
                              toast.error(
                                "Select an authorized operator first."
                              );
                              return;
                            }
                            approve.mutate({
                              purchaseId: p.id,
                              operatorId: Number(assignments[p.id]),
                            });
                          }}
                        >
                          Approve & assign
                        </Button>
                      </>
                    )}
                    {canPost && p.status === "draft" && (
                      <Button
                        variant="quiet"
                        onClick={() => {
                          if (
                            window.confirm("Post this purchase into inventory?")
                          )
                            receive.mutate({ purchaseId: p.id });
                        }}
                      >
                        <ArrowDownLeft size={14} />
                        Receive
                      </Button>
                    )}
                    {owner && canPost && Number(p.balanceCents) > 0 && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          setPayForm({
                            id: p.id,
                            purchaseNo: p.purchaseNo,
                            balanceCents: Number(p.balanceCents),
                            amount: String(Number(p.balanceCents) / 100),
                            method: "cash",
                            cashLocation: owner ? "owner" : "operator",
                            holder: "",
                            reference: "",
                          })
                        }
                      >
                        <CreditCard size={14} />
                        Pay
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      ) : (
        <Empty
          title="No purchases in view"
          detail="Only real supplier proposals and receipts appear here."
        />
      )}
    </Frame>
  );
}
function Sales({ products, owner, role, userId, operators }: Any) {
  const [show, setShow] = useState(false),
    [showCustomer, setShowCustomer] = useState(false),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(iso(fromDate)),
    [to, setTo] = useState(iso(today)),
    [customerForm, setCustomerForm] = useState<Any>({}),
    [f, setF] = useState<Any>({
      saleDate: iso(today),
      lines: [{ product: "", packs: "1", price: "", discount: "" }],
      location: "owner",
      paymentMethod: "cash",
    });
  const api = useApi(),
    u = trpc.useUtils(),
    customers = api.customers.list.useQuery({}),
    q = api.sales.list.useQuery({
      search: search.trim() || undefined,
      from: dateAt(from),
      to: new Date(`${to}T23:59:59`),
    }),
    createCustomer = api.customers.create.useMutation({
      onSuccess: () => {
        toast.success("Store account added");
        setShowCustomer(false);
        setCustomerForm({});
        void u.business.customers.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    create = api.sales.create.useMutation({
      onSuccess: () => {
        toast.success("Sale posted");
        setShow(false);
        void u.business.sales.list.invalidate();
        void u.business.inventory.list.invalidate();
        void u.business.deliveries.list.invalidate();
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    collect = api.sales.collect.useMutation({
      onSuccess: () => {
        toast.success("Collection/refund posted");
        void u.business.sales.list.invalidate();
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    ret = api.sales.returnPacks.useMutation({
      onSuccess: () => {
        toast.success("Customer return recorded");
        void u.business.sales.list.invalidate();
        void u.business.inventory.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    });
  const setLine = (index: number, key: string, value: string) =>
    setF((prev: Any) => ({
      ...prev,
      lines: prev.lines.map((line: Any, i: number) =>
        i === index ? { ...line, [key]: value } : line
      ),
    }));
  const lineTotal = (line: Any) => {
    const packs = Number(line.packs || 0),
      price = parseMoneyToCents(line.price || "0"),
      discount = parseMoneyToCents(line.discount || "0");
    return Math.max(0, packs * price - discount);
  };
  const total =
    (f.lines ?? []).reduce((n: number, l: Any) => n + lineTotal(l), 0) -
    parseMoneyToCents(f.headerDiscount || "0");
  const submitCustomer = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!customerForm.storeName?.trim())
        throw Error("Store name is required.");
      createCustomer.mutate({
        storeName: customerForm.storeName.trim(),
        contactName: customerForm.contactName?.trim() || undefined,
        contact: customerForm.contact?.trim() || undefined,
        address: customerForm.address?.trim() || undefined,
        notes: customerForm.notes?.trim() || undefined,
      });
    } catch (x) {
      toast.error(err(x));
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const lines = (f.lines ?? []).map((line: Any) => ({
        productId: Number(line.product),
        packs: Number(line.packs),
        unitPriceCents: parseMoneyToCents(line.price || "0"),
        discountCents: parseMoneyToCents(line.discount || "0"),
      }));
      if (!f.store?.trim())
        throw Error("Select a store account or enter a store name.");
      if (
        !lines.length ||
        lines.some(
          (x: Any) =>
            !x.productId ||
            x.packs <= 0 ||
            x.unitPriceCents < 0 ||
            x.discountCents < 0 ||
            x.discountCents > x.packs * x.unitPriceCents
        )
      )
        throw Error(
          "Each line needs a product, positive packs, valid price and a discount no greater than the line gross."
        );
      const headerDiscountCents = parseMoneyToCents(f.headerDiscount || "0"),
        paidNowCents = parseMoneyToCents(f.paid || "0");
      if (total <= 0 || headerDiscountCents < 0)
        throw Error("Sale total must be greater than zero.");
      if (paidNowCents < 0 || paidNowCents > total)
        throw Error("Collected amount cannot exceed the sale total.");
      if (paidNowCents > 0 && f.location === "operator" && !f.operator)
        throw Error(
          "Assign an operator when the initial collection is operator-held."
        );
      if (!window.confirm(`Post this ${money(total)} sale and reduce stock?`))
        return;
      create.mutate({
        idempotencyKey: crypto.randomUUID(),
        customerId: f.customer ? Number(f.customer) : undefined,
        storeName: f.store.trim(),
        saleDate: dateAt(f.saleDate || iso(today)),
        headerDiscountCents,
        operatorId: f.operator ? Number(f.operator) : undefined,
        notes: f.notes?.trim() || undefined,
        paidNowCents,
        paymentMethod: f.paymentMethod || "cash",
        cashLocation: paidNowCents > 0 ? f.location || "owner" : undefined,
        collectionReference: f.reference?.trim() || undefined,
        lines,
      });
    } catch (x) {
      toast.error(err(x));
    }
  };
  return (
    <Frame
      title="Sales and Store Accounts"
      eyebrow="Wholesale orders"
      action={
        <div className="flex flex-wrap gap-2">
          {owner && (
            <Button
              onClick={() => {
                setShow(!show);
                setShowCustomer(false);
              }}
            >
              <Plus size={16} />
              Post sale
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowCustomer(!showCustomer)}
          >
            <Store size={15} />
            Store account
          </Button>
        </div>
      }
    >
      <DateFilter {...{ from, to, setFrom, setTo }} />
      <div className="mb-5 mt-5 max-w-md">
        <Field
          label="Search sales and stores"
          placeholder="Invoice number or store name"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {showCustomer && (
        <form
          onSubmit={submitCustomer}
          className="mb-5 grid gap-3 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4 md:grid-cols-4"
        >
          <Field
            label="Store name *"
            value={customerForm.storeName || ""}
            onChange={e =>
              setCustomerForm({ ...customerForm, storeName: e.target.value })
            }
          />
          <Field
            label="Contact name"
            value={customerForm.contactName || ""}
            onChange={e =>
              setCustomerForm({ ...customerForm, contactName: e.target.value })
            }
          />
          <Field
            label="Contact"
            value={customerForm.contact || ""}
            onChange={e =>
              setCustomerForm({ ...customerForm, contact: e.target.value })
            }
          />
          <Field
            label="Address"
            value={customerForm.address || ""}
            onChange={e =>
              setCustomerForm({ ...customerForm, address: e.target.value })
            }
          />
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096] md:col-span-3">
            <span>Notes</span>
            <textarea
              className="min-h-10 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431] outline-none focus:border-[#6c5ce7]"
              value={customerForm.notes || ""}
              onChange={e =>
                setCustomerForm({ ...customerForm, notes: e.target.value })
              }
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">Save store account</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustomer(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {show && owner && (
        <form
          onSubmit={submit}
          className="mb-5 grid gap-4 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4"
        >
          <div className="grid gap-3 md:grid-cols-4">
            <SelectField
              label="Store account"
              value={f.customer || ""}
              onChange={e => {
                const c = (customers.data ?? []).find(
                  (x: Any) => String(x.id) === e.target.value
                );
                setF({
                  ...f,
                  customer: e.target.value,
                  store: c?.storeName || f.store || "",
                });
              }}
            >
              <option value="">No saved account</option>
              {(customers.data ?? []).map((c: Any) => (
                <option key={c.id} value={c.id}>
                  {c.storeName}
                </option>
              ))}
            </SelectField>
            <Field
              label="Store name *"
              value={f.store || ""}
              onChange={e => setF({ ...f, store: e.target.value })}
            />
            <Field
              label="Sale date *"
              type="date"
              value={f.saleDate}
              onChange={e => setF({ ...f, saleDate: e.target.value })}
            />
            <Field
              label="Invoice reference"
              value={f.reference || ""}
              onChange={e => setF({ ...f, reference: e.target.value })}
            />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
                Pack lines *
              </p>
              <Button
                type="button"
                variant="quiet"
                onClick={() =>
                  setF((prev: Any) => ({
                    ...prev,
                    lines: [
                      ...prev.lines,
                      { product: "", packs: "1", price: "", discount: "" },
                    ],
                  }))
                }
              >
                <Plus size={14} />
                Add line
              </Button>
            </div>
            <div className="space-y-3">
              {(f.lines ?? []).map((line: Any, index: number) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl border border-[#e7e7f0] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px_140px_auto]"
                >
                  <SelectField
                    label={`Product ${index + 1}`}
                    value={line.product}
                    onChange={e => {
                      const p = products.find(
                        (x: Any) => String(x.id) === e.target.value
                      );
                      setLine(index, "product", e.target.value);
                      if (p)
                        setLine(
                          index,
                          "price",
                          String(Number(p.defaultPriceCents) / 100)
                        );
                    }}
                  >
                    <option value="">Choose active product</option>
                    {products.map((p: Any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.packDescription} · {num(p.stockPacks)} on
                        hand
                      </option>
                    ))}
                  </SelectField>
                  <Field
                    label="Packs *"
                    type="number"
                    min="1"
                    value={line.packs}
                    onChange={e => setLine(index, "packs", e.target.value)}
                  />
                  <Money
                    label="Unit price *"
                    value={line.price}
                    setValue={v => setLine(index, "price", v)}
                  />
                  <Money
                    label="Line discount"
                    value={line.discount}
                    setValue={v => setLine(index, "discount", v)}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    className="self-end"
                    disabled={f.lines.length === 1}
                    onClick={() =>
                      setF((prev: Any) => ({
                        ...prev,
                        lines: prev.lines.filter(
                          (_: Any, i: number) => i !== index
                        ),
                      }))
                    }
                  >
                    <X size={15} />
                    <span className="sm:hidden">Remove</span>
                  </Button>
                  <p className="text-xs font-bold text-[#6c5ce7] sm:col-span-4">
                    Line total: {money(lineTotal(line))}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Money
              label="Overall discount"
              value={f.headerDiscount || ""}
              setValue={v => setF({ ...f, headerDiscount: v })}
            />
            <Money
              label="Collected now"
              value={f.paid || ""}
              setValue={v => setF({ ...f, paid: v })}
            />
            <SelectField
              label="Payment method"
              value={f.paymentMethod}
              onChange={e => setF({ ...f, paymentMethod: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="e_wallet">E-wallet</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </SelectField>
            <SelectField
              label="Cash location"
              value={f.location}
              onChange={e =>
                setF({
                  ...f,
                  location: e.target.value,
                  operator: e.target.value === "operator" ? f.operator : "",
                })
              }
            >
              {locations.map(x => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
            {f.location === "operator" && (
              <Holder
                role={role}
                operators={operators}
                value={f.operator || ""}
                setValue={v => setF({ ...f, operator: v })}
              />
            )}
            <SelectField
              label="Assign delivery operator"
              value={f.operator || ""}
              onChange={e => setF({ ...f, operator: e.target.value })}
            >
              <option value="">No delivery assignment</option>
              {operators.map((o: Any) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.email}
                </option>
              ))}
            </SelectField>
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096] md:col-span-2">
              <span>Notes</span>
              <textarea
                className="min-h-10 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431]"
                value={f.notes || ""}
                onChange={e => setF({ ...f, notes: e.target.value })}
              />
            </label>
            <div className="rounded-xl bg-[#eeecff] px-3 py-2 text-sm font-bold md:col-span-2">
              Invoice total: {money(Math.max(0, total))}
            </div>
            <div className="flex items-end">
              <Button type="submit">Post sale</Button>
            </div>
          </div>
        </form>
      )}
      <div className="mb-5 rounded-2xl border border-[#e7e7f0] bg-white p-4">
        <h3 className="font-black">Store accounts</h3>
        {customers.isLoading ? (
          <p className="mt-2 text-sm text-[#758096]">Loading store accounts…</p>
        ) : customers.data?.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {customers.data.map((c: Any) => (
              <div key={c.id} className="rounded-xl bg-[#ffffff] p-3">
                <p className="font-semibold">{c.storeName}</p>
                <p className="text-xs text-[#758096]">
                  {c.contactName || "No contact"}
                  {c.contact ? ` · ${c.contact}` : ""}
                </p>
                <p className="mt-1 text-xs text-[#758096]">
                  {c.address || "No address"}
                </p>
                {c.notes && (
                  <p className="mt-1 text-xs text-[#8b93a6]">{c.notes}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#758096]">
            No store accounts yet. Add one before posting an invoice when
            useful.
          </p>
        )}
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <Table
          headers={[
            "Sale",
            "Store",
            "Date",
            "Invoice",
            "Collected",
            "Balance",
            "Delivery",
            "Actions",
          ]}
        >
          {q.data.map((s: Any) => (
            <tr key={s.id}>
              <td className="px-4 py-3 font-mono text-xs font-bold">
                {s.saleNo}
              </td>
              <td className="px-4 py-3 font-semibold">{s.storeName}</td>
              <td className="px-4 py-3">{dateLabel(s.saleDate)}</td>
              <td className="px-4 py-3">{money(s.totalCents)}</td>
              <td className="px-4 py-3">{money(s.collectionsCents)}</td>
              <td className="px-4 py-3 font-bold">{money(s.balanceCents)}</td>
              <td className="px-4 py-3">
                <Pill value={s.deliveryStatus} />
              </td>
              <td className="px-4 py-3">
                <div className="flex min-w-[190px] flex-wrap gap-2">
                  <Button
                    variant="quiet"
                    onClick={() => {
                      const v = prompt("Amount in PHP");
                      if (!v) return;
                      const kind = confirm("OK = collection; Cancel = refund")
                        ? "collection"
                        : "refund";
                      if (confirm(`Post ${kind}?`))
                        collect.mutate({
                          saleId: s.id,
                          kind,
                          amountCents: parseMoneyToCents(v),
                          method: "cash",
                          cashLocation:
                            role === "operator" ? "operator" : "owner",
                          holderUserId:
                            role === "operator" ? userId : undefined,
                          idempotencyKey: crypto.randomUUID(),
                          collectedAt: new Date(),
                          reference:
                            prompt("Reference (optional)") || undefined,
                        });
                    }}
                  >
                    Collect / refund
                  </Button>
                  {s.lines?.map((l: Any) => (
                    <Button
                      key={l.id}
                      variant="outline"
                      onClick={() => {
                        const v = prompt(
                            `Return packs for ${l.productName} (max ${l.packs})`
                          ),
                          reason = v && prompt("Reason (required)");
                        if (!v || !reason) return;
                        if (confirm("Record this return?"))
                          ret.mutate({
                            saleId: s.id,
                            saleLineId: l.id,
                            packs: Number(v),
                            restockable: confirm(
                              "Restockable? OK = yes, Cancel = no"
                            ),
                            reason,
                            idempotencyKey: crypto.randomUUID(),
                            returnedAt: new Date(),
                          });
                      }}
                    >
                      Return {l.productName}
                    </Button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty
          title="No sales yet"
          detail="No operational sales are invented; post a real wholesale invoice."
        />
      )}
    </Frame>
  );
}
function Inventory({ owner }: Any) {
  const [search, setSearch] = useState(""),
    api = useApi(),
    q = api.inventory.list.useQuery({ search: search.trim() || undefined }),
    u = trpc.useUtils(),
    count = api.inventory.count.useMutation({
      onSuccess: () => {
        toast.success("Stock count posted");
        void u.business.inventory.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    adjust = api.inventory.adjust.useMutation({
      onSuccess: () => {
        toast.success("Adjustment posted");
        void u.business.inventory.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    [f, setF] = useState<Any>({});
  return (
    <Frame title="Inventory" eyebrow="Pack control">
      <p className="mb-4 rounded-xl bg-[#ffffff] px-4 py-3 text-sm text-[#758096]">
        Quantities are **pack units**, not individual pieces. Money is PHP.
      </p>
      <div className="mb-5 max-w-md">
        <Field
          label="Search inventory"
          placeholder="SKU or product name"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <Table
          headers={[
            "Product",
            "On hand",
            "Reorder",
            "Average cost",
            "Owner actions",
          ]}
        >
          {q.data.map((p: Any) => (
            <tr key={p.productId}>
              <td className="px-4 py-3 font-semibold">
                {p.name}
                <div className="text-xs font-normal text-[#8b93a6]">
                  {p.sku} · {p.packDescription}
                </div>
              </td>
              <td className="px-4 py-3 font-black">
                {num(p.stockPacks)} packs
              </td>
              <td className="px-4 py-3">{num(p.reorderPacks)} packs</td>
              <td className="px-4 py-3">
                {p.averageCostCents == null
                  ? "Operator view"
                  : money(p.averageCostCents)}
              </td>
              <td className="px-4 py-3">
                {owner && (
                  <div className="flex gap-2">
                    <input
                      className="h-9 w-20 rounded-lg border px-2"
                      type="number"
                      min="0"
                      placeholder="packs"
                      value={f[p.productId]?.packs || ""}
                      onChange={e =>
                        setF({
                          ...f,
                          [p.productId]: {
                            ...f[p.productId],
                            packs: e.target.value,
                          },
                        })
                      }
                    />
                    <input
                      className="h-9 w-28 rounded-lg border px-2"
                      placeholder="note"
                      value={f[p.productId]?.note || ""}
                      onChange={e =>
                        setF({
                          ...f,
                          [p.productId]: {
                            ...f[p.productId],
                            note: e.target.value,
                          },
                        })
                      }
                    />
                    <Button
                      variant="quiet"
                      onClick={() => {
                        const x = f[p.productId];
                        if (!x?.packs || !x.note)
                          return toast.error("Count and note are required.");
                        if (confirm("Post this stock count?"))
                          count.mutate({
                            productId: p.productId,
                            countedPacks: Number(x.packs),
                            notes: x.note,
                            idempotencyKey: crypto.randomUUID(),
                          });
                      }}
                    >
                      Count
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        const x = f[p.productId];
                        if (!x?.packs || !x.note)
                          return toast.error("Packs and note are required.");
                        if (confirm("Post damage adjustment?"))
                          adjust.mutate({
                            productId: p.productId,
                            kind: "damage",
                            packs: Number(x.packs),
                            notes: x.note,
                            idempotencyKey: crypto.randomUUID(),
                          });
                      }}
                    >
                      Damage
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty
          title="Inventory is empty"
          detail="Receive a purchase to start tracking pack movements."
        />
      )}
    </Frame>
  );
}

function Deliveries({ owner }: Any) {
  const api = useApi(),
    q = api.deliveries.list.useQuery(),
    u = trpc.useUtils();
  const [drafts, setDrafts] = useState<Record<number, Any>>({});
  const makeDraft = (d: Any) => ({
    lines: (d.lines ?? []).map((line: Any) => ({
      saleLineId: Number(line.saleLineId ?? line.id),
      productName: line.productName ?? line.name ?? line.sku ?? "Product",
      assignedPacks: Number(line.assignedPacks ?? line.packs ?? 0),
      deliveredPacks: String(
        line.deliveredPacks ?? line.assignedPacks ?? line.packs ?? 0
      ),
      returnedPacks: "0",
      restockable: false,
      reason: "",
    })),
    discrepancyNote: "",
    notes: "",
  });
  const complete = api.deliveries.complete.useMutation({
    onSuccess: (result: Any) => {
      const shortage = Number(result?.missingPacks ?? 0);
      toast.success(
        shortage > 0
          ? `Delivery completed — ${shortage} pack${shortage === 1 ? "" : "s"} shortage recorded.`
          : "Delivery completed — all assigned packs accounted for."
      );
      setDrafts({});
      void u.business.deliveries.list.invalidate();
      void u.business.inventory.list.invalidate();
      void u.business.sales.list.invalidate();
    },
    onError: (e: Any) => toast.error(err(e)),
  });
  const deliveryFor = (deliveryId: number) =>
    (q.data ?? []).find((delivery: Any) => Number(delivery.id) === deliveryId);
  const setDraftValue = (deliveryId: number, key: string, value: Any) =>
    setDrafts(prev => {
      const current = prev[deliveryId] ?? makeDraft(deliveryFor(deliveryId));
      return { ...prev, [deliveryId]: { ...current, [key]: value } };
    });
  const setLineValue = (
    deliveryId: number,
    index: number,
    key: string,
    value: Any
  ) =>
    setDrafts(prev => {
      const current = prev[deliveryId] ?? makeDraft(deliveryFor(deliveryId));
      return {
        ...prev,
        [deliveryId]: {
          ...current,
          lines: current.lines.map((line: Any, i: number) =>
            i === index ? { ...line, [key]: value } : line
          ),
        },
      };
    });
  const submit = (d: Any, draft: Any) => {
    try {
      const lines = (draft.lines ?? []).map((line: Any) => {
        const delivered = Number(line.deliveredPacks),
          returned = Number(line.returnedPacks),
          assigned = Number(line.assignedPacks);
        if (!Number.isInteger(delivered) || delivered < 0)
          throw Error(
            `Enter a whole delivered quantity for ${line.productName}.`
          );
        if (!Number.isInteger(returned) || returned < 0)
          throw Error(
            `Enter a whole returned quantity for ${line.productName}.`
          );
        if (delivered + returned > assigned)
          throw Error(
            `${line.productName}: delivered plus returned packs cannot exceed ${assigned} assigned.`
          );
        if (returned > 0 && !line.reason?.trim())
          throw Error(`Enter a reason for returned ${line.productName} packs.`);
        return { ...line, assigned, delivered, returned };
      });
      const shortage = lines.reduce(
        (total: number, line: Any) =>
          total + line.assigned - line.delivered - line.returned,
        0
      );
      if (shortage > 0 && !draft.discrepancyNote?.trim())
        throw Error("Enter a discrepancy note for missing or short packs.");
      const returns = lines
        .filter((line: Any) => line.returned > 0)
        .map((line: Any) => ({
          saleLineId: line.saleLineId,
          packs: line.returned,
          restockable: Boolean(line.restockable),
          reason: line.reason.trim(),
        }));
      if (
        !confirm(
          `Complete ${d.deliveryNo}?\n\nTotal shortage: ${shortage} pack${shortage === 1 ? "" : "s"}.\nReturned packs are tracked separately from missing packs.`
        )
      )
        return;
      complete.mutate({
        deliveryId: Number(d.id),
        lineCounts: lines.map((line: Any) => ({
          saleLineId: line.saleLineId,
          deliveredPacks: line.delivered,
        })),
        returns,
        discrepancyNote:
          shortage > 0 ? draft.discrepancyNote.trim() : undefined,
        notes: draft.notes?.trim() || undefined,
      });
    } catch (e) {
      toast.error(err(e));
    }
  };
  return (
    <Frame
      title="Deliveries and Operator"
      eyebrow={owner ? "Route handoff" : "My assigned route"}
    >
      <p className="mb-4 rounded-xl bg-[#ffffff] px-4 py-3 text-sm text-[#758096]">
        Record actual delivered packs per line. Returned packs are separate from
        missing packs; add a reason for every return.
      </p>
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <div className="space-y-4">
          {q.data.map((d: Any) => {
            const draft = drafts[d.id] ?? makeDraft(d),
              completed = d.status !== "assigned",
              totalShortage = (d.lines ?? []).reduce(
                (total: number, line: Any) =>
                  total + Number(line.shortagePacks ?? 0),
                0
              );
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-[#e7e7f0] bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold">
                      {d.deliveryNo}
                    </p>
                    <p className="font-semibold">
                      {d.sale?.storeName ?? "Store"} · cash due{" "}
                      {money(d.cashDueCents)}
                    </p>
                  </div>
                  <Pill value={d.status} />
                </div>
                {completed ? (
                  <div className="mt-4 rounded-xl bg-[#ffffff] p-3 text-sm">
                    <p
                      className={`font-bold ${d.status === "discrepancy" ? "text-[#a13d3d]" : "text-[#47a67b]"}`}
                    >
                      {d.status === "discrepancy"
                        ? `Delivery discrepancy · ${totalShortage} pack${totalShortage === 1 ? "" : "s"} short`
                        : d.status === "returned"
                          ? "All assigned packs returned"
                          : "All assigned packs delivered"}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-[#758096]">
                      {(d.lines ?? []).map((line: Any) => (
                        <p key={line.id ?? line.saleLineId}>
                          {line.productName ??
                            line.name ??
                            line.sku ??
                            "Product"}
                          : assigned {Number(line.assignedPacks ?? 0)},
                          delivered {Number(line.deliveredPacks ?? 0)}, returned{" "}
                          {Number(line.returnedPacks ?? 0)}
                          {Number(line.shortagePacks ?? 0) > 0
                            ? ` · shortage ${Number(line.shortagePacks)}`
                            : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3">
                      {draft.lines.map((line: Any, index: number) => (
                        <div
                          key={line.saleLineId}
                          className="rounded-xl border border-[#e7e7f0] bg-[#ffffff] p-3"
                        >
                          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold">{line.productName}</p>
                            <span className="text-xs text-[#758096]">
                              Assigned: {line.assignedPacks} packs
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field
                              label="Actual delivered packs"
                              type="number"
                              min="0"
                              max={line.assignedPacks}
                              step="1"
                              inputMode="numeric"
                              value={line.deliveredPacks}
                              onChange={e =>
                                setLineValue(
                                  d.id,
                                  index,
                                  "deliveredPacks",
                                  e.target.value
                                )
                              }
                            />
                            <Field
                              label="Returned packs"
                              type="number"
                              min="0"
                              max={line.assignedPacks}
                              step="1"
                              inputMode="numeric"
                              value={line.returnedPacks}
                              onChange={e =>
                                setLineValue(
                                  d.id,
                                  index,
                                  "returnedPacks",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          {Number(line.returnedPacks) > 0 && (
                            <div className="mt-3 grid gap-3">
                              <label className="flex min-h-10 items-center gap-2 text-sm text-[#202431]">
                                <input
                                  type="checkbox"
                                  checked={Boolean(line.restockable)}
                                  onChange={e =>
                                    setLineValue(
                                      d.id,
                                      index,
                                      "restockable",
                                      e.target.checked
                                    )
                                  }
                                />
                                Restock returned packs
                              </label>
                              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
                                <span>Return reason *</span>
                                <textarea
                                  className="min-h-16 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431]"
                                  value={line.reason}
                                  onChange={e =>
                                    setLineValue(
                                      d.id,
                                      index,
                                      "reason",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Why were these packs returned?"
                                />
                              </label>
                            </div>
                          )}
                          <p className="mt-2 text-xs text-[#758096]">
                            Missing from this line:{" "}
                            {Math.max(
                              0,
                              Number(line.assignedPacks) -
                                Number(line.deliveredPacks || 0) -
                                Number(line.returnedPacks || 0)
                            )}{" "}
                            packs
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
                        <span>
                          Discrepancy note{" "}
                          {draft.lines.some(
                            (line: Any) =>
                              Number(line.assignedPacks) -
                                Number(line.deliveredPacks || 0) -
                                Number(line.returnedPacks || 0) >
                              0
                          ) && "*"}
                        </span>
                        <textarea
                          className="min-h-16 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431]"
                          value={draft.discrepancyNote}
                          onChange={e =>
                            setDraftValue(
                              d.id,
                              "discrepancyNote",
                              e.target.value
                            )
                          }
                          placeholder="Required when assigned packs are missing"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
                        <span>Delivery notes</span>
                        <textarea
                          className="min-h-16 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431]"
                          value={draft.notes}
                          onChange={e =>
                            setDraftValue(d.id, "notes", e.target.value)
                          }
                          placeholder="Optional route notes"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[#6c5ce7]">
                        Total shortage:{" "}
                        {draft.lines.reduce(
                          (total: number, line: Any) =>
                            total +
                            Math.max(
                              0,
                              Number(line.assignedPacks) -
                                Number(line.deliveredPacks || 0) -
                                Number(line.returnedPacks || 0)
                            ),
                          0
                        )}{" "}
                        packs
                      </p>
                      <Button
                        disabled={complete.isPending}
                        onClick={() => submit(d, draft)}
                      >
                        <Check size={15} />
                        Complete route
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No assigned deliveries"
          detail={
            owner
              ? "Assigned operator routes appear after a sale is assigned."
              : "The owner has not assigned a delivery to you."
          }
        />
      )}
    </Frame>
  );
}
function Cash({ role, userId, operators, owner }: Any) {
  const [from, setFrom] = useState(iso(fromDate)),
    [to, setTo] = useState(iso(today)),
    [f, setF] = useState<Any>({
      from: "owner",
      to: "operator",
      direction: "in",
      location: "owner",
      method: "cash",
      occurredAt: iso(today),
    }),
    api = useApi(),
    q = api.cash.list.useQuery({
      from: dateAt(from),
      to: new Date(`${to}T23:59:59`),
    }),
    u = trpc.useUtils(),
    transfer = api.cash.transfer.useMutation({
      onSuccess: () => {
        toast.success("Cash transfer posted");
        setF((x: Any) => ({ ...x, amount: "", note: "" }));
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    adjust = api.cash.adjust.useMutation({
      onSuccess: () => {
        toast.success("Referenced cash adjustment posted");
        setF((x: Any) => ({
          ...x,
          adjustAmount: "",
          reference: "",
          reason: "",
        }));
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    reconcile = api.cash.reconcile.useMutation({
      onSuccess: () => {
        toast.success("Cash reconciliation posted");
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    });
  const holder = (loc: string, key: string) =>
    loc === "operator" ? (
      <Holder
        role={role}
        operators={operators}
        value={f[key] || ""}
        setValue={v => setF({ ...f, [key]: v })}
      />
    ) : null;
  const postAdjust = () => {
    try {
      const amountCents = parseMoneyToCents(f.adjustAmount || "0");
      if (!owner) return;
      if (!amountCents || amountCents <= 0)
        throw Error("Adjustment amount must be positive.");
      if (!f.reference?.trim()) throw Error("A reference is required.");
      if (!f.reason?.trim()) throw Error("A reason is required.");
      if (f.adjustLocation === "operator" && !f.adjustHolder)
        throw Error("Select the operator cash holder.");
      if (
        !window.confirm(
          "Post this referenced cash adjustment? It is append-only and not revenue."
        )
      )
        return;
      adjust.mutate({
        location: f.adjustLocation || "owner",
        holderUserId:
          f.adjustLocation === "operator" ? Number(f.adjustHolder) : undefined,
        direction: f.direction || "in",
        amountCents,
        method: f.adjustMethod || "cash",
        reference: f.reference.trim(),
        reason: f.reason.trim(),
        idempotencyKey: crypto.randomUUID(),
        occurredAt: dateAt(f.occurredAt || iso(today)),
      });
    } catch (e) {
      toast.error(err(e));
    }
  };
  return (
    <Frame title="Cash Ledger" eyebrow="Movement by location">
      <DateFilter {...{ from, to, setFrom, setTo }} />
      <div className="my-5 grid gap-3 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4 md:grid-cols-4">
        <SelectField
          label="From"
          value={f.from}
          onChange={e => setF({ ...f, from: e.target.value })}
        >
          {locations.map(x => (
            <option key={x}>{x}</option>
          ))}
        </SelectField>
        {holder(f.from, "fromHolder")}
        <SelectField
          label="To"
          value={f.to}
          onChange={e => setF({ ...f, to: e.target.value })}
        >
          {locations.map(x => (
            <option key={x}>{x}</option>
          ))}
        </SelectField>
        {holder(f.to, "toHolder")}
        <Money
          label="Amount (PHP)"
          value={f.amount || ""}
          setValue={v => setF({ ...f, amount: v })}
        />
        <SelectField
          label="Transfer method"
          value={f.transferMethod || "cash"}
          onChange={e => setF({ ...f, transferMethod: e.target.value })}
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="e_wallet">E-wallet</option>
          <option value="check">Check</option>
          <option value="other">Other</option>
        </SelectField>
        <Field
          label="Transfer reference"
          value={f.note || ""}
          onChange={e => setF({ ...f, note: e.target.value })}
        />
        <Button
          onClick={() => {
            try {
              const amountCents = parseMoneyToCents(f.amount || "0");
              if (!amountCents) throw Error("Transfer amount is required.");
              if (f.from === f.to)
                throw Error("Choose two different cash locations.");
              if (f.from === "operator" && role !== "operator" && !f.fromHolder)
                throw Error("Select source operator holder.");
              if (f.to === "operator" && role !== "operator" && !f.toHolder)
                throw Error("Select destination operator holder.");
              if (window.confirm("Post this cash transfer?"))
                transfer.mutate({
                  from: f.from,
                  to: f.to,
                  fromHolderUserId: f.fromHolder
                    ? Number(f.fromHolder)
                    : role === "operator"
                      ? userId
                      : undefined,
                  toHolderUserId: f.toHolder
                    ? Number(f.toHolder)
                    : role === "operator"
                      ? userId
                      : undefined,
                  amountCents,
                  method: f.transferMethod || "cash",
                  reference: f.note?.trim() || undefined,
                  notes: f.note?.trim() || undefined,
                  idempotencyKey: crypto.randomUUID(),
                  occurredAt: new Date(),
                });
            } catch (e) {
              toast.error(err(e));
            }
          }}
        >
          Transfer cash
        </Button>
        <div className="flex gap-2 md:col-span-2">
          <Money
            label="Counted cash (PHP)"
            value={f.counted || ""}
            setValue={v => setF({ ...f, counted: v })}
          />
          <Button
            variant="outline"
            onClick={() => {
              const loc = f.to,
                holderId =
                  loc === "operator"
                    ? role === "operator"
                      ? userId
                      : Number(f.toHolder || 0)
                    : undefined;
              if (!f.counted) return toast.error("Enter counted cash.");
              if (loc === "operator" && !holderId)
                return toast.error("Select the operator holder.");
              if (window.confirm("Post this cash reconciliation?"))
                reconcile.mutate({
                  location: loc,
                  holderUserId: holderId,
                  countedCents: parseMoneyToCents(f.counted),
                  notes: f.note || undefined,
                  idempotencyKey: crypto.randomUUID(),
                  countedAt: new Date(),
                });
            }}
          >
            Reconcile cash
          </Button>
        </div>
      </div>
      {owner && (
        <div className="my-5 rounded-2xl border border-[#e7e7f0] bg-white p-4">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#f0a34b]">
              Owner-only append-only correction
            </p>
            <p className="mt-1 text-sm text-[#758096]">
              Referenced adjustments correct recorded cash location balances;
              they are not revenue and cannot edit or delete prior movements.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <SelectField
              label="Adjustment location"
              value={f.adjustLocation || "owner"}
              onChange={e =>
                setF({ ...f, adjustLocation: e.target.value, adjustHolder: "" })
              }
            >
              {locations.map(x => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
            {f.adjustLocation === "operator" && (
              <Holder
                role="owner"
                operators={operators}
                value={f.adjustHolder || ""}
                setValue={v => setF({ ...f, adjustHolder: v })}
              />
            )}
            <SelectField
              label="Direction"
              value={f.direction || "in"}
              onChange={e => setF({ ...f, direction: e.target.value })}
            >
              <option value="in">In</option>
              <option value="out">Out</option>
            </SelectField>
            <Money
              label="Positive amount (PHP) *"
              value={f.adjustAmount || ""}
              setValue={v => setF({ ...f, adjustAmount: v })}
            />
            <SelectField
              label="Payment method"
              value={f.adjustMethod || "cash"}
              onChange={e => setF({ ...f, adjustMethod: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="e_wallet">E-wallet</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </SelectField>
            <Field
              label="Occurred at *"
              type="date"
              value={f.occurredAt || iso(today)}
              onChange={e => setF({ ...f, occurredAt: e.target.value })}
            />
            <Field
              label="Reference *"
              value={f.reference || ""}
              onChange={e => setF({ ...f, reference: e.target.value })}
            />
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096] md:col-span-3">
              <span>Reason *</span>
              <textarea
                className="min-h-10 rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431]"
                value={f.reason || ""}
                onChange={e => setF({ ...f, reason: e.target.value })}
              />
            </label>
            <div className="flex items-end">
              <Button onClick={postAdjust}>Post adjustment</Button>
            </div>
          </div>
        </div>
      )}
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <Table
          headers={[
            "When",
            "Kind",
            "Direction",
            "Location",
            "Holder",
            "Amount",
            "Reference",
          ]}
        >
          {q.data.map((r: Any) => (
            <tr key={r.id}>
              <td className="px-4 py-3">{dateLabel(r.occurredAt)}</td>
              <td className="px-4 py-3 capitalize">
                {String(r.kind).replaceAll("_", " ")}
                {r.sourceType === "manual_adjustment" && (
                  <div className="text-[10px] text-[#f0a34b]">
                    Referenced adjustment · not revenue
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {r.direction === "in" ? (
                  <ArrowDownLeft className="text-[#31704e]" size={15} />
                ) : (
                  <ArrowUpRight className="text-[#a13d3d]" size={15} />
                )}
              </td>
              <td className="px-4 py-3">
                <Pill value={r.location} />
              </td>
              <td className="px-4 py-3">{r.holderUserId ?? "—"}</td>
              <td className="px-4 py-3 font-bold">{money(r.amountCents)}</td>
              <td className="px-4 py-3">{r.reference || "—"}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty
          title="No cash movements"
          detail="The ledger reflects only recorded cash events."
        />
      )}
    </Frame>
  );
}
function Expenses({ role, userId, operators }: Any) {
  const [show, setShow] = useState(false),
    [adjustingId, setAdjustingId] = useState<number | null>(null),
    [adjustment, setAdjustment] = useState<Any>({
      direction: "increase",
      amount: "",
      reference: "",
      reason: "",
    }),
    [f, setF] = useState<Any>({
      costType: "operations",
      status: "unpaid",
      location: "owner",
    }),
    api = useApi(),
    q = api.expenses.list.useQuery({}),
    purchases = api.purchases.list.useQuery({}),
    deliveries = api.deliveries.list.useQuery(),
    u = trpc.useUtils(),
    create = api.expenses.create.useMutation({
      onSuccess: () => {
        toast.success("Expense recorded");
        setShow(false);
        void u.business.expenses.list.invalidate();
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    pay = api.expenses.pay.useMutation({
      onSuccess: () => {
        toast.success("Expense payment recorded");
        void u.business.expenses.list.invalidate();
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    adjust = api.expenses.adjust.useMutation({
      onSuccess: () => {
        toast.success("Expense adjustment recorded");
        setAdjustingId(null);
        setAdjustment({
          direction: "increase",
          amount: "",
          reference: "",
          reason: "",
        });
        void u.business.expenses.list.invalidate();
        void u.business.reports.dashboard.invalidate();
        void u.business.reports.weekly.invalidate();
        void u.business.purchases.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    });
  const ownerOnly = role === "owner";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!f.category || !f.description || !f.amount)
        throw Error("Category, description and invoice amount are required.");
      if (f.costType === "purchase" && !f.purchase)
        throw Error("Select a draft purchase.");
      if (role === "operator" && !f.delivery)
        throw Error("Operator expenses must link to your assigned delivery.");
      if (
        f.status === "paid" &&
        f.location === "operator" &&
        role === "owner" &&
        !f.holder
      )
        throw Error("Select operator holder.");
      if (!confirm("Post this expense and any cash payment?")) return;
      create.mutate({
        idempotencyKey: crypto.randomUUID(),
        category: f.category,
        description: f.description,
        invoiceAmountCents: parseMoneyToCents(f.amount),
        allocationBps: Math.round(Number(f.allocation || 100) * 100),
        allocationBasis: f.basis || undefined,
        externalAllocationRef: f.external || undefined,
        sharedVehicle: Boolean(f.shared),
        expenseDate: new Date(),
        status: f.status,
        costType: f.costType,
        purchaseId: f.purchase ? Number(f.purchase) : undefined,
        deliveryId: f.delivery ? Number(f.delivery) : undefined,
        receiptRef: f.receipt || undefined,
        paidFrom: f.location,
        holderUserId: f.holder
          ? Number(f.holder)
          : role === "operator"
            ? userId
            : undefined,
        cashPaidCents: parseMoneyToCents(f.paid || "0"),
        notes: f.notes || undefined,
      });
    } catch (x) {
      toast.error(err(x));
    }
  };
  const submitAdjustment = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!adjustingId) throw Error("Choose an expense to adjust.");
      const amountCents = parseMoneyToCents(adjustment.amount || "0");
      if (!Number.isInteger(amountCents) || amountCents <= 0)
        throw Error("Enter a positive adjustment amount in PHP.");
      const reference = String(adjustment.reference || "").trim();
      const reason = String(adjustment.reason || "").trim();
      if (!reference) throw Error("Reference is required.");
      if (!reason) throw Error("Reason is required.");
      const deltaCents =
        adjustment.direction === "decrease" ? -amountCents : amountCents;
      if (
        !window.confirm(
          `${adjustment.direction === "decrease" ? "Decrease" : "Increase"} this expense by ${money(amountCents)}?`
        )
      )
        return;
      adjust.mutate({
        expenseId: adjustingId,
        deltaCents,
        reference,
        reason,
        idempotencyKey: crypto.randomUUID(),
        adjustedAt: new Date(),
      });
    } catch (x) {
      toast.error(err(x));
    }
  };
  return (
    <Frame
      title="Expenses"
      eyebrow="Business costs"
      action={
        <Button onClick={() => setShow(!show)}>
          <Plus size={16} />
          Record expense
        </Button>
      }
    >
      {show && (
        <form
          onSubmit={submit}
          className="mb-5 grid gap-3 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4 md:grid-cols-4"
        >
          <Field
            label="Category *"
            value={f.category || ""}
            onChange={e => setF({ ...f, category: e.target.value })}
          />
          <Field
            label="Description *"
            value={f.description || ""}
            onChange={e => setF({ ...f, description: e.target.value })}
          />
          <Money
            label="Invoice amount (PHP) *"
            value={f.amount || ""}
            setValue={v => setF({ ...f, amount: v })}
          />
          <SelectField
            label="Cost type"
            value={f.costType}
            onChange={e => setF({ ...f, costType: e.target.value })}
          >
            <option value="operations">Operations</option>
            <option value="purchase">
              Direct purchase cost before receipt
            </option>
          </SelectField>
          {f.costType === "purchase" && (
            <SelectField
              label="Draft purchase *"
              value={f.purchase || ""}
              onChange={e => setF({ ...f, purchase: e.target.value })}
            >
              <option value="">Choose draft</option>
              {(purchases.data ?? [])
                .filter((x: Any) => x.status === "draft")
                .map((x: Any) => (
                  <option key={x.id} value={x.id}>
                    {x.purchaseNo} · {x.supplierName}
                  </option>
                ))}
            </SelectField>
          )}
          {role === "operator" && (
            <SelectField
              label="Assigned delivery *"
              value={f.delivery || ""}
              onChange={e => setF({ ...f, delivery: e.target.value })}
            >
              <option value="">Choose delivery</option>
              {(deliveries.data ?? []).map((x: Any) => (
                <option key={x.id} value={x.id}>
                  {x.deliveryNo}
                </option>
              ))}
            </SelectField>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(f.shared)}
              onChange={e => setF({ ...f, shared: e.target.checked })}
            />
            Shared Hyundai H100 allocation
          </label>
          {f.shared && (
            <>
              <Field
                label="Allocation %"
                type="number"
                min="1"
                max="100"
                value={f.allocation || "100"}
                onChange={e => setF({ ...f, allocation: e.target.value })}
              />
              <Field
                label="Allocation basis"
                value={f.basis || ""}
                onChange={e => setF({ ...f, basis: e.target.value })}
              />
              <Field
                label="External allocation reference"
                value={f.external || ""}
                onChange={e => setF({ ...f, external: e.target.value })}
              />
            </>
          )}
          <SelectField
            label="Status"
            value={f.status}
            onChange={e => setF({ ...f, status: e.target.value })}
          >
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid now</option>
          </SelectField>
          {f.status === "paid" && (
            <Money
              label="Pay now (PHP)"
              value={f.paid || ""}
              setValue={v => setF({ ...f, paid: v })}
            />
          )}
          <Field
            label="Receipt reference"
            value={f.receipt || ""}
            onChange={e => setF({ ...f, receipt: e.target.value })}
          />
          {f.status === "paid" && f.location === "operator" && (
            <Holder
              role={role}
              operators={operators}
              value={f.holder || ""}
              setValue={v => setF({ ...f, holder: v })}
            />
          )}
          <Button type="submit">Save expense</Button>
        </form>
      )}
      {ownerOnly && (
        <p className="mb-4 rounded-xl border border-[#e7e7f0] bg-[#ffffff] px-4 py-3 text-xs text-[#758096]">
          Owner adjustments change the business-allocated amount only. A
          decrease cannot take it below cash already paid, and direct-purchase
          landed costs can be adjusted only until the linked purchase is
          received.
        </p>
      )}
      {q.isLoading ? (
        <Loading />
      ) : q.data?.length ? (
        <Table
          headers={[
            "Date",
            "Category",
            "Description",
            "Business allocated",
            "Paid",
            "Type",
            "Action",
          ]}
        >
          {q.data.map((x: Any) => (
            <Fragment key={x.id}>
              <tr key={x.id}>
                <td className="px-4 py-3">{dateLabel(x.expenseDate)}</td>
                <td className="px-4 py-3">{x.category}</td>
                <td className="px-4 py-3">
                  {x.description}
                  {x.sharedVehicle && (
                    <div className="text-xs text-[#f0a34b]">
                      Hyundai H100 · {Number(x.allocationBps) / 100}%
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold">{money(x.amountCents)}</div>
                  <div className="text-xs text-[#758096]">Current share</div>
                </td>
                <td className="px-4 py-3">{money(x.cashPaidCents)}</td>
                <td className="px-4 py-3">
                  <Pill value={x.costType} />
                </td>
                <td className="px-4 py-3">
                  {Number(x.cashPaidCents) < Number(x.amountCents) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const v = prompt("Payment amount in PHP");
                        if (v && confirm("Post expense payment?"))
                          pay.mutate({
                            expenseId: x.id,
                            amountCents: parseMoneyToCents(v),
                            paidFrom:
                              role === "operator" ? "operator" : "owner",
                            holderUserId:
                              role === "operator" ? userId : undefined,
                            method: "cash",
                            idempotencyKey: crypto.randomUUID(),
                            paidAt: new Date(),
                          });
                      }}
                    >
                      Pay
                    </Button>
                  )}
                  {ownerOnly && (
                    <Button
                      className="mt-2"
                      variant="outline"
                      onClick={() => {
                        setAdjustingId(x.id);
                        setAdjustment({
                          direction: "increase",
                          amount: "",
                          reference: "",
                          reason: "",
                        });
                      }}
                    >
                      Adjust
                    </Button>
                  )}
                </td>
              </tr>
              {adjustingId === x.id && ownerOnly && (
                <tr>
                  <td colSpan={7} className="bg-[#ffffff] px-4 py-4">
                    <form
                      onSubmit={submitAdjustment}
                      className="grid gap-3 rounded-xl border border-[#e7e7f0] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
                    >
                      <SelectField
                        label="Adjustment"
                        value={adjustment.direction}
                        onChange={e =>
                          setAdjustment({
                            ...adjustment,
                            direction: e.target.value,
                          })
                        }
                      >
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                      </SelectField>
                      <Money
                        label="Positive amount (PHP) *"
                        value={adjustment.amount}
                        setValue={v =>
                          setAdjustment({ ...adjustment, amount: v })
                        }
                      />
                      <Field
                        label="Reference *"
                        value={adjustment.reference}
                        onChange={e =>
                          setAdjustment({
                            ...adjustment,
                            reference: e.target.value,
                          })
                        }
                      />
                      <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#758096] sm:col-span-2 lg:col-span-2">
                        <span>Reason *</span>
                        <textarea
                          required
                          rows={2}
                          value={adjustment.reason}
                          onChange={e =>
                            setAdjustment({
                              ...adjustment,
                              reason: e.target.value,
                            })
                          }
                          className="rounded-xl border border-[#deddea] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#202431] outline-none focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/15"
                        />
                      </label>
                      <div className="flex items-end gap-2 lg:col-span-5">
                        <Button type="submit" disabled={adjust.isPending}>
                          Confirm adjustment
                        </Button>
                        <Button
                          type="button"
                          variant="quiet"
                          onClick={() => setAdjustingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </td>
                </tr>
              )}
              {x.adjustments?.length ? (
                <tr>
                  <td colSpan={7} className="bg-[#f7f7fc] px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-[.12em] text-[#758096]">
                      Adjustment history
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {x.adjustments.map((a: Any) => (
                        <div
                          key={a.id}
                          className="rounded-xl border border-[#e7e7f0] bg-white p-3 text-xs text-[#758096]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[#202431]">
                            <span>
                              {Number(a.deltaCents) >= 0
                                ? "Increase"
                                : "Decrease"}{" "}
                              {money(Math.abs(Number(a.deltaCents)))}
                            </span>
                            <span>{dateLabel(a.adjustedAt)}</span>
                          </div>
                          <div className="mt-1">
                            {money(a.previousAmountCents)} →{" "}
                            {money(a.newAmountCents)}
                          </div>
                          <div className="mt-1 text-[#202431]">
                            <span className="font-semibold">{a.reference}</span>{" "}
                            · {a.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </Table>
      ) : (
        <Empty
          title="No expenses yet"
          detail="Record actual business costs; unpaid and paid amounts remain distinct."
        />
      )}
    </Frame>
  );
}

function Capital({ operators }: Any) {
  const [mode, setMode] = useState("record"),
    [f, setF] = useState<Any>({
      kind: "contribution",
      location: "owner",
      effective: iso(today),
    }),
    api = useApi(),
    q = api.capital.summary.useQuery(),
    u = trpc.useUtils(),
    init = api.capital.initializeSoleInvestor.useMutation({
      onSuccess: () => {
        toast.success("Gale initialized");
        void u.business.capital.summary.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    add = api.capital.addInvestor.useMutation({
      onSuccess: () => {
        toast.success("Investor, contribution and ownership posted atomically");
        void u.business.capital.summary.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    record = api.capital.record.useMutation({
      onSuccess: () => {
        toast.success("Capital transaction posted");
        void u.business.capital.summary.invalidate();
        void u.business.cash.list.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    ownership = api.capital.setOwnership.useMutation({
      onSuccess: () => {
        toast.success("Ownership snapshot authorized");
        void u.business.capital.summary.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    active = (q.data?.investors ?? []).filter((x: Any) => x.active),
    loc = (
      <>
        <SelectField
          label="Cash location"
          value={f.location}
          onChange={e => setF({ ...f, location: e.target.value })}
        >
          {locations.map(x => (
            <option key={x}>{x}</option>
          ))}
        </SelectField>
        {f.location === "operator" && (
          <Holder
            role="owner"
            operators={operators}
            value={f.holder || ""}
            setValue={v => setF({ ...f, holder: v })}
          />
        )}
      </>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "initialize") {
        if (active.length)
          throw Error("Initialize Gale only when no investor exists.");
        if (!f.agreement)
          throw Error("Ownership agreement reference is required.");
        if (confirm("Initialize Gale as the sole investor?"))
          init.mutate({
            name: "Gale",
            effectiveDate: f.effective,
            agreementReference: f.agreement,
            notes: f.notes || undefined,
          });
      } else if (mode === "add") {
        if (!f.name || !f.amount || !f.agreement || !f.newPct)
          throw Error(
            "Name, positive contribution, agreement and new percentage are required."
          );
        const newBps = Math.round(Number(f.newPct) * 100),
          existingShares = active.map((i: Any) => ({
            investorId: i.id,
            percentageBps: Math.round(Number(f[`existing_${i.id}`] || 0) * 100),
          }));
        if (
          existingShares.reduce(
            (n: number, x: Any) => n + x.percentageBps,
            newBps
          ) !== 10000
        )
          throw Error(
            "Existing allocations plus new percentage must total 100%."
          );
        if (
          confirm(
            "Add investor, contribution and ownership agreement atomically?"
          )
        )
          add.mutate({
            name: f.name,
            contributionCents: parseMoneyToCents(f.amount),
            cashLocation: f.location,
            holderUserId: f.holder ? Number(f.holder) : undefined,
            method: "cash",
            happenedAt: new Date(),
            effectiveDate: f.effective,
            agreementReference: f.agreement,
            newPercentageBps: newBps,
            existingShares,
            idempotencyKey: crypto.randomUUID(),
            notes: f.notes || undefined,
          });
      } else if (mode === "ownership") {
        const shares = active.map((i: Any) => ({
          investorId: i.id,
          percentageBps: Math.round(Number(f[`pct_${i.id}`] || 0) * 100),
        }));
        if (
          shares.reduce((n: number, x: Any) => n + x.percentageBps, 0) !== 10000
        )
          throw Error("All active investor shares must total 100%.");
        if (!f.agreement) throw Error("Agreement reference is required.");
        ownership.mutate({
          effectiveDate: f.effective,
          agreementReference: f.agreement,
          notes: f.notes || undefined,
          shares,
        });
      } else {
        if (!f.investor || !f.amount || !f.agreement)
          throw Error("Investor, positive amount and reference are required.");
        if (confirm("Post this capital transaction?"))
          record.mutate({
            kind: f.kind,
            investorId: Number(f.investor),
            amountCents: parseMoneyToCents(f.amount),
            cashLocation: f.location,
            holderUserId: f.holder ? Number(f.holder) : undefined,
            happenedAt: new Date(),
            reference: f.agreement,
            notes: f.notes || undefined,
            idempotencyKey: crypto.randomUUID(),
          });
      }
    } catch (x) {
      toast.error(err(x));
    }
  };
  return (
    <Frame
      title="Investor and Capital"
      eyebrow="Ownership & funding"
      action={
        <div className="flex flex-wrap gap-2">
          {["record", "initialize", "add", "ownership"].map(x => (
            <Button
              key={x}
              variant={mode === x ? "primary" : "outline"}
              onClick={() => setMode(x)}
            >
              {x === "add"
                ? "Add investor"
                : x === "initialize"
                  ? "Initialize Gale"
                  : x === "ownership"
                    ? "Ownership snapshot"
                    : "Record"}
            </Button>
          ))}
        </div>
      }
    >
      {q.isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <Kpi
              label="Investors"
              value={num(active.length)}
              note="Active only"
            />
            <Kpi
              label="Transactions"
              value={num(q.data?.transactions?.length)}
              note="Capital ledger"
              accent="caramel"
            />
            <Kpi
              label="Ownership records"
              value={num(q.data?.ownership?.length)}
              note="Agreement snapshots"
              accent="green"
            />
          </div>
          <form
            onSubmit={submit}
            className="mb-5 grid gap-3 rounded-2xl border border-[#e7e7f0] bg-[#ffffff] p-4 md:grid-cols-4"
          >
            {mode === "initialize" && (
              <>
                <p className="md:col-span-4 text-sm text-[#758096]">
                  Initial setup is only available when no investor exists.
                  Nikkie is never auto-created.
                </p>
                <Field
                  label="Agreement reference *"
                  value={f.agreement || ""}
                  onChange={e => setF({ ...f, agreement: e.target.value })}
                />
                <Field
                  label="Effective date"
                  type="date"
                  value={f.effective}
                  onChange={e => setF({ ...f, effective: e.target.value })}
                />
              </>
            )}
            {mode === "add" && (
              <>
                <Field
                  label="Investor name *"
                  value={f.name || ""}
                  onChange={e => setF({ ...f, name: e.target.value })}
                />
                <Money
                  label="Positive contribution (PHP) *"
                  value={f.amount || ""}
                  setValue={v => setF({ ...f, amount: v })}
                />
                <Field
                  label="New ownership % *"
                  type="number"
                  value={f.newPct || ""}
                  onChange={e => setF({ ...f, newPct: e.target.value })}
                />
                {active.map((i: Any) => (
                  <Field
                    key={i.id}
                    label={`${i.name} existing allocation %`}
                    type="number"
                    value={f[`existing_${i.id}`] || ""}
                    onChange={e =>
                      setF({ ...f, [`existing_${i.id}`]: e.target.value })
                    }
                  />
                ))}
                <Field
                  label="Agreement reference *"
                  value={f.agreement || ""}
                  onChange={e => setF({ ...f, agreement: e.target.value })}
                />
                <Field
                  label="Effective date"
                  type="date"
                  value={f.effective}
                  onChange={e => setF({ ...f, effective: e.target.value })}
                />
                {loc}
              </>
            )}
            {mode === "ownership" && (
              <>
                {active.map((i: Any) => (
                  <Field
                    key={i.id}
                    label={`${i.name} ownership %`}
                    type="number"
                    value={f[`pct_${i.id}`] || ""}
                    onChange={e =>
                      setF({ ...f, [`pct_${i.id}`]: e.target.value })
                    }
                  />
                ))}
                <Field
                  label="Agreement reference *"
                  value={f.agreement || ""}
                  onChange={e => setF({ ...f, agreement: e.target.value })}
                />
                <Field
                  label="Effective date"
                  type="date"
                  value={f.effective}
                  onChange={e => setF({ ...f, effective: e.target.value })}
                />
              </>
            )}
            {mode === "record" && (
              <>
                <SelectField
                  label="Investor *"
                  value={f.investor || ""}
                  onChange={e => setF({ ...f, investor: e.target.value })}
                >
                  <option value="">Choose active investor</option>
                  {active.map((i: Any) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Transaction"
                  value={f.kind}
                  onChange={e => setF({ ...f, kind: e.target.value })}
                >
                  <option value="contribution">Contribution</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="distribution">Profit distribution</option>
                </SelectField>
                <Money
                  label="Positive amount (PHP)"
                  value={f.amount || ""}
                  setValue={v => setF({ ...f, amount: v })}
                />
                <Field
                  label="Agreement / reference"
                  value={f.agreement || ""}
                  onChange={e => setF({ ...f, agreement: e.target.value })}
                />
                {loc}
              </>
            )}
            {mode !== "initialize" && (
              <Field
                label="Notes"
                value={f.notes || ""}
                onChange={e => setF({ ...f, notes: e.target.value })}
              />
            )}
            <Button type="submit">
              {mode === "add"
                ? "Add investor atomically"
                : mode === "ownership"
                  ? "Authorize snapshot"
                  : mode === "initialize"
                    ? "Initialize Gale"
                    : "Post transaction"}
            </Button>
          </form>
          <Table headers={["Investor", "Active", "Ownership"]}>
            {(q.data?.investors ?? []).map((i: Any) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-semibold">{i.name}</td>
                <td className="px-4 py-3">
                  <Pill value={i.active ? "active" : "inactive"} />
                </td>
                <td className="px-4 py-3">
                  {(q.data?.ownership ?? [])
                    .filter((x: Any) => x.investorId === i.id)
                    .map((x: Any) => `${Number(x.percentageBps) / 100}%`)
                    .join(", ") || "No snapshot"}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Frame>
  );
}
function Reports({ weekly, dashboard, title }: Any) {
  const range = dashboard?.selectedRange,
    rangeLabel =
      range?.from && range?.to
        ? `${dateLabel(range.from)} – ${dateLabel(range.to)}`
        : "Selected reporting period",
    exportCsv = () => {
      const quote = (value: unknown) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;
      const rows = [
        ["Candy Distribution Manager", title],
        ["Period", rangeLabel],
        [],
        ["Metric", "Amount (PHP)"],
        ["Revenue", money(dashboard?.period?.revenueCents)],
        ["Cost of goods sold", money(dashboard?.period?.cogsCents)],
        ["Gross profit", money(dashboard?.period?.grossProfitCents)],
        [
          "Operating expenses",
          money(dashboard?.period?.operatingExpensesCents),
        ],
        ["Net profit", money(dashboard?.period?.netProfitCents)],
        ["Customer collections", money(dashboard?.period?.collectionsCents)],
        ["Customer return credits", money(weekly?.returnCreditsCents)],
        [],
        ["Product", "Packs", "Revenue (PHP)"],
        ...(weekly?.productBreakdown ?? []).map((item: Any) => [
          item.name,
          item.packs,
          money(item.revenueCents),
        ]),
      ];
      const csv = rows.map(row => row.map(quote).join(",")).join("\n");
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${iso(today)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    };
  return (
    <Frame
      title={title}
      eyebrow="Owner reporting"
      action={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" onClick={exportCsv}>
            <Download size={15} />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer size={15} />
            Print report
          </Button>
        </div>
      }
    >
      <p className="mb-5 text-sm text-[#758096]">
        Reporting period:{" "}
        <span className="font-semibold text-[#202431]">{rangeLabel}</span>
        <span className="ml-2 rounded-full bg-[#eeecff] px-2 py-1 text-xs font-bold text-[#5145b8]">
          PHP · calculated from recorded transactions
        </span>
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Kpi
          label="Revenue"
          value={money(dashboard?.period?.revenueCents)}
          note="Selected period"
        />
        <Kpi
          label="Net profit"
          value={money(dashboard?.period?.netProfitCents)}
          note="Profit is not cash"
          accent="green"
        />
        <Kpi
          label="Return credits"
          value={money(weekly?.returnCreditsCents)}
          note="Customer credits"
          accent="caramel"
        />
      </div>
      {weekly?.productBreakdown?.length ? (
        <div className="mt-5">
          <Table headers={["Product", "Packs", "Revenue"]}>
            {weekly.productBreakdown.map((x: Any) => (
              <tr key={x.name}>
                <td className="px-4 py-3">{x.name}</td>
                <td className="px-4 py-3">{num(x.packs)} packs</td>
                <td className="px-4 py-3">{money(x.revenueCents)}</td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <div className="mt-5">
          <Empty
            title="No report data"
            detail="No live sales exist in this period."
          />
        </div>
      )}
    </Frame>
  );
}
function Settings({ user }: Any) {
  const api = useApi(),
    q = api.access.pending.useQuery(),
    u = trpc.useUtils(),
    setOp = api.access.setOperator.useMutation({
      onSuccess: () => {
        toast.success("Operator access updated");
        void u.business.access.pending.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    settings = api.settings.get.useQuery(),
    update = api.settings.update.useMutation({
      onSuccess: () => {
        toast.success("Settings saved");
        void u.business.settings.get.invalidate();
      },
      onError: (e: Any) => toast.error(err(e)),
    }),
    audit = api.audit.list.useQuery({ limit: 100 }),
    [budget, setBudget] = useState(""),
    [name, setName] = useState(""),
    [days, setDays] = useState(""),
    [location, setLocation] = useState("");
  return (
    <Frame title="Settings and Audit Log" eyebrow="Controls & trail">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e7e7f0] bg-white p-5">
          <h3 className="font-black">Operator access</h3>
          <p className="mt-1 text-xs text-[#758096]">
            Approve pending accounts or revoke an operator back to pending.
          </p>
          <div className="mt-4 space-y-2">
            {(q.data ?? [])
              .filter((x: Any) => x.id !== user.id && x.role !== "owner")
              .map((x: Any) => (
                <div
                  key={x.id}
                  className="flex items-center justify-between rounded-xl bg-[#ffffff] p-3"
                >
                  <div>
                    <p className="font-semibold">{x.name || x.email}</p>
                    <p className="text-xs text-[#758096]">
                      {x.email} · {x.role}
                    </p>
                  </div>
                  {x.role === "operator" ? (
                    <Button
                      variant="danger"
                      onClick={() =>
                        setOp.mutate({ userId: x.id, enabled: false })
                      }
                    >
                      Revoke
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        setOp.mutate({ userId: x.id, enabled: true })
                      }
                    >
                      Approve
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#e7e7f0] bg-white p-5">
          <h3 className="font-black">Business settings</h3>
          <div className="mt-4 grid gap-3">
            <Field
              label="Initial budget (PHP)"
              value={
                budget ||
                String(Number(settings.data?.initialBudgetCents ?? 0) / 100)
              }
              onChange={e => setBudget(e.target.value)}
            />
            <Field
              label="Initial investor name"
              value={name || settings.data?.initialInvestorName || "Gale"}
              onChange={e => setName(e.target.value)}
            />
            <Field
              label="Turnover target days"
              type="number"
              value={days || String(settings.data?.turnoverTargetDays ?? 7)}
              onChange={e => setDays(e.target.value)}
            />
            <Field
              label="Purchasing location"
              placeholder="Divisoria, Philippines"
              value={
                location ||
                settings.data?.purchasingLocation ||
                "Divisoria, Philippines"
              }
              onChange={e => setLocation(e.target.value)}
            />
            <Button
              onClick={() => {
                try {
                  const purchasingLocation = (
                    location ||
                    settings.data?.purchasingLocation ||
                    "Divisoria, Philippines"
                  ).trim();
                  if (!purchasingLocation)
                    throw Error("Purchasing location is required.");
                  update.mutate({
                    initialBudgetCents: parseMoneyToCents(
                      budget ||
                        String(
                          Number(settings.data?.initialBudgetCents ?? 0) / 100
                        )
                    ),
                    initialInvestorName:
                      name || settings.data?.initialInvestorName || "Gale",
                    turnoverTargetDays: Number(
                      days || settings.data?.turnoverTargetDays || 7
                    ),
                    purchasingLocation,
                  });
                } catch (e) {
                  toast.error(err(e));
                }
              }}
            >
              Save settings
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-5">
        {audit.data?.length ? (
          <Table headers={["When", "Action", "Record", "ID"]}>
            {audit.data.map((x: Any) => (
              <tr key={x.id}>
                <td className="px-4 py-3">{dateLabel(x.happenedAt)}</td>
                <td className="px-4 py-3">
                  {String(x.action).replaceAll("_", " ")}
                </td>
                <td className="px-4 py-3">{x.recordType}</td>
                <td className="px-4 py-3">{x.recordId ?? "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title="No audit events yet"
            detail="Every material business action leaves a server audit trail."
          />
        )}
      </div>
    </Frame>
  );
}
function Home() {
  const { loading, user, logout } = useAuth(),
    [location] = useLocation(),
    [mobile, setMobile] = useState(false),
    [moreOpen, setMoreOpen] = useState(true),
    [from, setFrom] = useState(iso(fromDate)),
    [to, setTo] = useState(iso(today)),
    api = useApi(),
    owner = user?.role === "owner",
    enabled = Boolean(user),
    range = { from: dateAt(from), to: new Date(`${to}T23:59:59`) },
    products = api.products.list.useQuery({ activeOnly: true }, { enabled }),
    access = api.access.pending.useQuery(undefined, {
      enabled: enabled && owner,
    }),
    dashboard = api.reports.dashboard.useQuery(range, {
      enabled: enabled && owner,
    }),
    weekly = api.reports.weekly.useQuery(range, { enabled: enabled && owner }),
    salesRows = api.sales.list.useQuery(range, { enabled: enabled && owner }),
    ops = api.operations.summary.useQuery(undefined, {
      enabled: enabled && !owner,
    });
  if (loading) return <Loading />;
  if (!user)
    return (
      <div className="people-auth-screen">
        <div className="people-auth-card">
          <img src="/candy-logo.png" alt="CANDY" className="people-auth-logo" />
          <p className="people-auth-kicker">BUSINESS MANAGER</p>
          <h1>Sign in to use the business ledger.</h1>
          <p className="people-auth-copy">
            Use your Manus account to access the Candy Distribution Manager.
            Owner and operator permissions are checked on the server after
            sign-in.
          </p>
          <Button
            className="people-auth-button"
            onClick={() => {
              try {
                startLogin();
              } catch (e) {
                toast.error(err(e));
              }
            }}
          >
            Sign in with Manus
          </Button>
          <p className="people-auth-note">
            New accounts remain pending until the configured owner approves
            operator access.
          </p>
        </div>
      </div>
    );
  if (user.role !== "owner" && user.role !== "operator")
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8ff] px-5">
        <div className="max-w-lg rounded-3xl border border-[#e7e7f0] bg-white p-8 text-center">
          <FileClock className="mx-auto text-[#f0a34b]" size={30} />
          <h1 className="mt-4 text-2xl font-black">
            Access awaiting owner approval
          </h1>
          <p className="mt-2 text-sm text-[#758096]">
            Your account is signed in, but an owner must authorize operator
            access before business data is available.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => void logout()}
          >
            <LogOut size={15} />
            Sign out
          </Button>
        </div>
      </div>
    );
  const operators = (access.data ?? []).filter(
      (x: Any) => x.role === "operator"
    ),
    content =
      location === "/" ? (
        <Dashboard
          owner={owner}
          data={dashboard.data}
          operations={ops.data}
          salesRows={salesRows.data ?? []}
          {...{ from, to, setFrom, setTo }}
        />
      ) : location === "/products" ? (
        <Products owner={owner} />
      ) : location === "/purchases" ? (
        <Purchases
          products={products.data ?? []}
          role={user.role}
          userId={user.id}
          operators={operators}
        />
      ) : location === "/sales" ? (
        <Sales
          products={products.data ?? []}
          owner={owner}
          role={user.role}
          userId={user.id}
          operators={operators}
        />
      ) : location === "/inventory" ? (
        <Inventory owner={owner} />
      ) : location === "/deliveries" ? (
        <Deliveries owner={owner} />
      ) : location === "/cash" ? (
        <Cash
          role={user.role}
          userId={user.id}
          operators={operators}
          owner={owner}
        />
      ) : location === "/expenses" ? (
        <Expenses role={user.role} userId={user.id} operators={operators} />
      ) : location === "/capital" ? (
        owner ? (
          <Capital operators={operators} />
        ) : (
          <Restricted />
        )
      ) : location === "/profit" ? (
        owner ? (
          <Reports
            title="Profit and Reinvestment"
            dashboard={dashboard.data}
            weekly={weekly.data}
          />
        ) : (
          <Restricted />
        )
      ) : location === "/weekly-reports" ? (
        owner ? (
          <Reports
            title="Weekly Reports"
            dashboard={dashboard.data}
            weekly={weekly.data}
          />
        ) : (
          <Restricted />
        )
      ) : location === "/settings" ? (
        owner ? (
          <Settings user={user} />
        ) : (
          <Restricted />
        )
      ) : (
        <Dashboard
          owner={owner}
          data={dashboard.data}
          operations={ops.data}
          {...{ from, to, setFrom, setTo }}
        />
      );
  const primaryPaths = [
      "/",
      "/sales",
      "/inventory",
      "/cash",
      "/weekly-reports",
      "/settings",
    ],
    primaryNav = nav.filter(
      (x: Any) => primaryPaths.includes(x.path) && (!x.owner || owner)
    ),
    extraNav = nav.filter(
      (x: Any) => !primaryPaths.includes(x.path) && (!x.owner || owner)
    ),
    allNav = nav.filter((x: Any) => !x.owner || owner);
  return (
    <div className="reference-app-shell">
      <aside
        className={`reference-sidebar ${mobile ? "reference-sidebar-open" : ""}`}
      >
        <div className="reference-brand-row">
          <Link href="/" className="reference-brand-lockup">
            <img src="/candy-logo.png" alt="CANDY" />
            <span>BUSINESS MANAGER</span>
          </Link>
          <button
            className="reference-mobile-close lg:hidden"
            onClick={() => setMobile(false)}
          >
            <X size={17} />
          </button>
        </div>
        <nav className="reference-sidebar-nav">
          <p className="reference-nav-heading">OVERVIEW</p>
          {primaryNav.slice(0, 1).map(x => (
            <Link
              key={x.path}
              href={x.path}
              onClick={() => setMobile(false)}
              className={`reference-nav-item ${location === x.path ? "reference-nav-active" : ""}`}
            >
              <x.icon size={17} />
              <span>{x.path === "/" ? "Dashboard" : x.label}</span>
            </Link>
          ))}
          <p className="reference-nav-heading reference-nav-space">
            OPERATIONS
          </p>
          {primaryNav.slice(1, 4).map(x => (
            <Link
              key={x.path}
              href={x.path}
              onClick={() => setMobile(false)}
              className={`reference-nav-item ${location === x.path ? "reference-nav-active" : ""}`}
            >
              <x.icon size={17} />
              <span>
                {x.path === "/cash"
                  ? "Money"
                  : x.label.replace(" and Store Accounts", "")}
              </span>
            </Link>
          ))}
          <p className="reference-nav-heading reference-nav-space">ANALYTICS</p>
          {primaryNav.slice(4, 5).map(x => (
            <Link
              key={x.path}
              href={x.path}
              onClick={() => setMobile(false)}
              className={`reference-nav-item ${location === x.path ? "reference-nav-active" : ""}`}
            >
              <x.icon size={17} />
              <span>Reports</span>
            </Link>
          ))}
          <p className="reference-nav-heading reference-nav-space">SYSTEM</p>
          {primaryNav.slice(5).map(x => (
            <Fragment key={x.path}>
              <Link
                href={x.path}
                onClick={() => setMobile(false)}
                className="reference-nav-item"
              >
                <Archive size={17} />
                <span>Data &amp; Backups</span>
              </Link>
              <Link
                href={x.path}
                onClick={() => setMobile(false)}
                className={`reference-nav-item ${location === x.path ? "reference-nav-active" : ""}`}
              >
                <Settings2 size={17} />
                <span>Settings</span>
              </Link>
            </Fragment>
          ))}
          {extraNav.length > 0 && (
            <>
              <button
                className="reference-nav-more"
                onClick={() => setMoreOpen(!moreOpen)}
              >
                <span>More modules</span>
                <ChevronDown
                  size={15}
                  className={moreOpen ? "rotate-180" : ""}
                />
              </button>
              {moreOpen &&
                extraNav.map(x => (
                  <Link
                    key={x.path}
                    href={x.path}
                    onClick={() => setMobile(false)}
                    className={`reference-nav-item reference-nav-extra ${location === x.path ? "reference-nav-active" : ""}`}
                  >
                    <x.icon size={16} />
                    <span>{x.label}</span>
                  </Link>
                ))}
            </>
          )}
        </nav>
        <div className="reference-protected-card">
          <div className="reference-protected-title">
            <ShieldCheck size={15} /> Protected history
          </div>
          <p>
            Corrections are logged, and restore previews never change live
            records.
          </p>
        </div>
        <div className="reference-sidebar-footer">
          <button
            className="reference-lock-button"
            onClick={() => void logout()}
          >
            <Moon size={15} /> Lock access
          </button>
          <span className="reference-user-role">{user.role}</span>
        </div>
      </aside>
      <div className="reference-main-column">
        <header className="reference-topbar">
          <button
            className="reference-mobile-menu lg:hidden"
            onClick={() => setMobile(true)}
          >
            <Menu size={18} />
          </button>
          <Link href="/" className="corbel-header-brand">
            <img src="/candy-logo.png" alt="CANDY" />
            <span>BUSINESS LEDGER</span>
          </Link>
          <nav className="corbel-top-tabs" aria-label="Primary workspace">
            {allNav.map(x => (
              <Link
                key={x.path}
                href={x.path}
                className={`corbel-top-tab ${location === x.path ? "corbel-top-tab-active" : ""}`}
              >
                {x.path === "/"
                  ? "Dashboard"
                  : x.path === "/weekly-reports"
                    ? "Reports"
                    : x.path === "/sales"
                      ? "Sales"
                      : x.path === "/cash"
                        ? "Money"
                        : x.path === "/settings"
                          ? "Settings"
                          : x.label}
              </Link>
            ))}
          </nav>
          <div className="reference-topbar-actions">
            <div className="reference-topbar-search">
              ⌕ <span>Search anything...</span>
            </div>
            <button aria-label="Toggle theme">
              <Moon size={17} />
            </button>
            <button aria-label="Notifications">
              <Bell size={17} />
            </button>
            <button
              className="reference-topbar-lock"
              onClick={() => void logout()}
            >
              <ShieldCheck size={15} /> Lock PIN access
            </button>
            <div className="reference-avatar">
              {(user.name || user.email || "C").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="reference-main-content">{content}</main>
      </div>
      {mobile && (
        <button
          className="reference-overlay lg:hidden"
          onClick={() => setMobile(false)}
          aria-label="Close navigation overlay"
        />
      )}
    </div>
  );
}

export default Home;
