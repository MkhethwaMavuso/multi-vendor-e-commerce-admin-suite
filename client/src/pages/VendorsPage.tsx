import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../services/api";
import type { Vendor } from "../types";
import { Button, Field, PageTitle, Panel, StatusPill } from "../components/ui";

type VendorForm = {
  storeName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
};

const emptyForm: VendorForm = {
  storeName: "",
  slug: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  status: "PENDING"
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState("");

  async function loadVendors() {
    const { data } = await api.get<{ vendors: Vendor[] }>("/vendors");
    setVendors(data.vendors);
  }
  useEffect(() => { void loadVendors().catch((requestError: unknown) => setError(errorMessage(requestError))); }, []);

  function editVendor(vendor: Vendor) {
    const owner = typeof vendor.ownerId === "object" && vendor.ownerId
      ? vendor.ownerId
      : { name: "", email: "" };
    setEditingId(vendor._id);
    setForm({
      storeName: vendor.storeName,
      slug: vendor.slug,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPassword: "",
      status: vendor.status === "ARCHIVED" ? "SUSPENDED" : vendor.status
    });
    setError("");
  }

  async function saveVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/vendors/${editingId}`, {
          storeName: form.storeName,
          slug: form.slug,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail
        });
      } else {
        await api.post("/vendors", {
          storeName: form.storeName,
          slug: form.slug,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword,
          status: form.status
        });
      }
      setEditingId("");
      setForm(emptyForm);
      await loadVendors();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(vendor: Vendor, status: "PENDING" | "ACTIVE" | "SUSPENDED") {
    setPendingId(vendor._id);
    setError("");
    try {
      await api.patch(`/vendors/${vendor._id}/status`, { status });
      await loadVendors();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPendingId("");
    }
  }

  async function archiveVendor(vendor: Vendor) {
    if (!window.confirm(`Archive ${vendor.storeName}? Its products and order history will be kept.`)) return;
    setPendingId(vendor._id);
    setError("");
    try {
      await api.delete(`/vendors/${vendor._id}`);
      await loadVendors();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPendingId("");
    }
  }

  const updateForm = (field: keyof VendorForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  return <>
    <PageTitle title="Vendors" description="Create vendors, manage their owners, and control marketplace access." />
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <Panel>
        <h2 className="font-bold">{editingId ? "Edit vendor" : "Add vendor"}</h2>
        <p className="mb-5 mt-1 text-sm text-muted">{editingId ? "Update store and owner details." : "Create a vendor and its owner account. New vendors start pending approval."}</p>
        <form onSubmit={(event) => void saveVendor(event)} className="space-y-3">
          <Field label="Store name" required minLength={2} maxLength={120} value={form.storeName} onChange={(event) => {
            const storeName = event.target.value;
            setForm((current) => ({ ...current, storeName, ...(!editingId ? { slug: slugify(storeName) } : {}) }));
          }} />
          <Field label="Store URL slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} value={form.slug} onChange={(event) => updateForm("slug", event.target.value)} />
          <Field label="Owner name" required minLength={2} maxLength={120} value={form.ownerName} onChange={(event) => updateForm("ownerName", event.target.value)} />
          <Field label="Owner email" type="email" required value={form.ownerEmail} onChange={(event) => updateForm("ownerEmail", event.target.value)} />
          {!editingId && <Field label="Initial owner password (12+ characters)" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={form.ownerPassword} onChange={(event) => updateForm("ownerPassword", event.target.value)} />}
          {!editingId && <label className="block space-y-1.5 text-sm font-medium text-ink">Initial status<select className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 font-normal" value={form.status} onChange={(event) => updateForm("status", event.target.value)}><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label>}
          <div className="flex gap-2">
            {editingId && <Button type="button" variant="secondary" className="flex-1" onClick={() => { setEditingId(""); setForm(emptyForm); }}>Cancel</Button>}
            <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving..." : editingId ? "Save changes" : "Create vendor"}</Button>
          </div>
        </form>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr>
              <th className="px-5 py-4 font-semibold">Store</th><th className="px-5 py-4 font-semibold">Owner</th><th className="px-5 py-4 font-semibold">Commission</th><th className="px-5 py-4 font-semibold">Created</th><th className="px-5 py-4 font-semibold">Status</th><th className="px-5 py-4" />
            </tr></thead>
            <tbody className="divide-y divide-line">{vendors.map((vendor) => {
              const owner = typeof vendor.ownerId === "object" && vendor.ownerId ? vendor.ownerId : undefined;
              return <tr key={vendor._id}>
                <td className="px-5 py-4"><div className="font-semibold">{vendor.storeName}</div><div className="mt-1 text-xs text-muted">/{vendor.slug}{vendor.isDemoData && " · demo"}</div></td>
                <td className="px-5 py-4"><div>{owner?.name ?? "Owner unavailable"}</div><div className="mt-1 text-xs text-muted">{owner?.email}</div></td>
                <td className="px-5 py-4">{vendor.commissionRate}%</td>
                <td className="px-5 py-4 text-muted">{new Date(vendor.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-4"><StatusPill>{vendor.status}</StatusPill></td>
                <td className="px-5 py-4 text-right"><div className="flex justify-end gap-2">
                  <Button variant="secondary" disabled={pendingId === vendor._id} onClick={() => editVendor(vendor)}>Edit</Button>
                  {vendor.status === "PENDING" && <Button variant="secondary" disabled={pendingId === vendor._id} onClick={() => void setStatus(vendor, "ACTIVE")}>Approve</Button>}
                  {vendor.status === "ACTIVE" && <Button variant="quiet" disabled={pendingId === vendor._id} onClick={() => void setStatus(vendor, "SUSPENDED")}>Suspend</Button>}
                  {vendor.status === "SUSPENDED" && <Button variant="secondary" disabled={pendingId === vendor._id} onClick={() => void setStatus(vendor, "ACTIVE")}>Activate</Button>}
                  {vendor.status === "ARCHIVED"
                    ? <Button variant="secondary" disabled={pendingId === vendor._id} onClick={() => void setStatus(vendor, "ACTIVE")}>Restore</Button>
                    : <Button variant="quiet" disabled={pendingId === vendor._id} onClick={() => void archiveVendor(vendor)}>Archive</Button>}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
          {vendors.length === 0 && <p className="p-8 text-center text-sm text-muted">No vendor accounts yet.</p>}
        </div>
      </Panel>
    </div>
  </>;
}
