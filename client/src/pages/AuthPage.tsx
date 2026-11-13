import { useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../services/api";
import { Button, Field } from "../components/ui";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", storeName: "" });
  const isRegister = mode === "register";
  const home = user?.role === "SUPER_ADMIN" ? "/admin/super" : "/admin/vendor";

  if (user) return <Navigate to={home} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const currentUser = isRegister
        ? await register({
            ...form,
            slug: form.storeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
          })
        : await login(form.email, form.password);
      navigate(currentUser.role === "SUPER_ADMIN" ? "/admin/super" : "/admin/vendor", { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_.95fr]">
    <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-black">V</div><span className="text-lg font-bold">VendorHub</span></div>
      <div className="max-w-xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-emerald-100"><ShieldCheck size={15} /> Built for multi-vendor teams</div><h1 className="text-5xl font-bold leading-tight">Your marketplace,<br /><span className="text-emerald-300">in sync.</span></h1><p className="mt-5 max-w-md leading-7 text-white/65">One clear workspace for vendor operations, inventory, fulfillment, and marketplace performance.</p></div>
      <p className="text-xs text-white/45">VendorHub • Marketplace operations</p>
    </section>
    <main className="flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-9 lg:hidden"><div className="mb-2 font-bold">VendorHub</div><p className="text-sm text-muted">Marketplace operations made clear.</p></div>
        <div className="mb-7"><p className="mb-2 text-sm font-semibold text-brand">{isRegister ? "START YOUR STORE" : "WELCOME BACK"}</p><h2 className="text-3xl font-bold tracking-tight">{isRegister ? "Create your account" : "Sign in to VendorHub"}</h2><p className="mt-2 text-sm text-muted">{isRegister ? "Your vendor application will be reviewed by the platform team." : "Enter your credentials to continue."}</p></div>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {isRegister && <><Field label="Your name" autoComplete="name" required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Field label="Store name" required minLength={2} value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></>}
          <Field label="Email address" type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Field label="Password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 12 : 1} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait..." : isRegister ? "Create vendor account" : "Sign in"}<ArrowRight size={16} /></Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">{isRegister ? "Already have an account?" : "New to VendorHub?"} <Link className="font-semibold text-brand hover:underline" to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create a vendor account"}</Link></p>
      </div>
    </main>
  </div>;
}
