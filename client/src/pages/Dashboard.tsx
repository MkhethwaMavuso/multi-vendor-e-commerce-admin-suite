import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Boxes, CircleDollarSign, ClipboardList, Store } from "lucide-react";
import { api, errorMessage } from "../services/api";
import type { Summary } from "../types";
import { PageTitle, Panel, StatusPill } from "../components/ui";

const emptySummary: Summary = { vendorCounts: null, activeProducts: 0, orderCount: 0, grossSales: 0, commissions: 0, payouts: 0 };
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Dashboard({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get<{ summary: Summary }>("/analytics/summary")
      .then(({ data }) => setSummary(data.summary))
      .catch((requestError: unknown) => setError(errorMessage(requestError)));
  }, []);

  const stats = [
    { label: isSuperAdmin ? "Total vendors" : "Active products", value: isSuperAdmin ? (summary.vendorCounts ?? []).reduce((total, item) => total + item.count, 0) : summary.activeProducts, icon: isSuperAdmin ? Store : Boxes },
    { label: "Orders", value: summary.orderCount, icon: ClipboardList },
    { label: "Gross income", value: currency.format(summary.grossSales), icon: CircleDollarSign },
    { label: isSuperAdmin ? "Platform commission" : "Vendor payout", value: currency.format(isSuperAdmin ? summary.commissions : summary.payouts), icon: isSuperAdmin ? ArrowUpRight : ArrowDownRight }
  ];

  return <>
    <PageTitle title={isSuperAdmin ? "Platform overview" : "Store overview"} description={isSuperAdmin ? "Monitor marketplace health and platform earnings." : "A quick view of your store's recent performance."} />
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => <Panel key={label}><div className="flex items-start justify-between"><div><p className="text-sm text-muted">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p></div><div className="rounded-xl bg-emerald-50 p-2.5 text-brand"><Icon size={19} /></div></div><p className="mt-4 text-xs text-muted">Lifetime activity</p></Panel>)}
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <Panel><div className="mb-5"><h2 className="font-bold">Commission report</h2><p className="mt-1 text-sm text-muted">Income and commission include paid orders only.</p></div><div className="space-y-5">{[{ label: "Gross income", value: summary.grossSales, color: "bg-slate-300" }, { label: "Platform commission", value: summary.commissions, color: "bg-brand" }, { label: "Vendor payout", value: summary.payouts, color: "bg-emerald-300" }].map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm"><span className="text-muted">{item.label}</span><strong>{currency.format(item.value)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-canvas"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${summary.grossSales > 0 ? Math.min(100, item.value / summary.grossSales * 100) : 0}%` }} /></div></div>)}</div></Panel>
      <Panel><h2 className="font-bold">{isSuperAdmin ? "Vendor status" : "Commission breakdown"}</h2><p className="mt-1 text-sm text-muted">{isSuperAdmin ? "Marketplace onboarding and health." : "Your payout after platform fees."}</p><div className="mt-6 space-y-4">{isSuperAdmin ? (summary.vendorCounts ?? []).map((item) => <div key={item._id} className="flex items-center justify-between"><StatusPill>{item._id}</StatusPill><span className="text-sm font-semibold">{item.count}</span></div>) : <><div className="flex justify-between text-sm"><span className="text-muted">Gross sales</span><strong>{currency.format(summary.grossSales)}</strong></div><div className="flex justify-between text-sm"><span className="text-muted">Platform commission</span><strong>{currency.format(summary.commissions)}</strong></div><div className="flex justify-between border-t border-line pt-4 text-sm"><span>Estimated payout</span><strong className="text-brand">{currency.format(summary.payouts)}</strong></div></>}</div></Panel>
    </div>
  </>;
}
