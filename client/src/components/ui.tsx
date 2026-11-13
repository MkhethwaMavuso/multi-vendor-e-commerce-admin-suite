import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet"; children: ReactNode }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-50",
    secondary: "border border-line bg-white text-ink hover:bg-canvas disabled:opacity-50",
    quiet: "text-muted hover:bg-canvas hover:text-ink"
  };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-5 shadow-panel ${className}`}>{children}</section>;
}

export function PageTitle({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1><p className="mt-1 text-sm text-muted">{description}</p></div>{action}</div>;
}

export function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block space-y-1.5 text-sm font-medium text-ink">{label}<input className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 font-normal outline-none transition placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/10" {...props} /></label>;
}

export function StatusPill({ children }: { children: string }) {
  const positive = ["ACTIVE", "PAID", "DELIVERED", "SHIPPED"].includes(children);
  const waiting = ["PENDING", "PROCESSING"].includes(children);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? "bg-emerald-50 text-emerald-700" : waiting ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{children.toLowerCase().replace(/_/g, " ")}</span>;
}
