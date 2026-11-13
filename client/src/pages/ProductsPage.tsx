import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../services/api";
import type { Product } from "../types";
import { Button, Field, PageTitle, Panel, StatusPill } from "../components/ui";

interface VariantInput {
  sku: string;
  price: string;
  stock: string;
  attributes: string;
}

const blankVariant = (): VariantInput => ({ sku: "", price: "", stock: "", attributes: "" });
const initialForm = { title: "", slug: "", category: "", variants: [blankVariant()] };

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busySku, setBusySku] = useState("");

  async function loadProducts() {
    const { data } = await api.get<{ products: Product[] }>("/products");
    setProducts(data.products);
  }
  useEffect(() => { loadProducts().catch((requestError: unknown) => setError(errorMessage(requestError))); }, []);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/products", {
        title: form.title,
        slug: form.slug,
        category: form.category,
        variants: form.variants.map((variant) => ({
          sku: variant.sku,
          attributes: Object.fromEntries(variant.attributes.split(",").map((pair) => pair.trim()).filter(Boolean).map((pair) => {
            const separator = pair.indexOf("=");
            return separator < 0 ? [pair, ""] : [pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()];
          })),
          price: Number(variant.price),
          stock: Number(variant.stock)
        }))
      });
      setForm(initialForm);
      await loadProducts();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function archiveProduct(productId: string) {
    setError("");
    try {
      await api.delete(`/products/${productId}`);
      await loadProducts();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function saveVariants(product: Product, variants: Product["variants"], sku: string) {
    setBusySku(sku);
    setError("");
    try {
      await api.patch(`/products/${product._id}`, { variants });
      await loadProducts();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusySku("");
    }
  }

  return <><PageTitle title="Products & inventory" description="Manage your catalog and available variant stock." />
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <Panel><h2 className="font-bold">Add a product</h2><p className="mb-5 mt-1 text-sm text-muted">Start with one SKU variant; more variants can be added in the catalog API.</p>
        <form onSubmit={(event) => void createProduct(event)} className="space-y-3">
          <Field label="Product title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value, slug: event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} />
          <Field label="URL slug" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
          <Field label="Category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <div className="space-y-3">{form.variants.map((variant, index) => <div key={index} className="rounded-xl border border-line p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted">Variant {index + 1}</span>{form.variants.length > 1 && <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setForm({ ...form, variants: form.variants.filter((_, variantIndex) => variantIndex !== index) })}>Remove</button>}</div><div className="grid grid-cols-2 gap-3"><Field label="SKU" required value={variant.sku} onChange={(event) => setForm({ ...form, variants: form.variants.map((entry, variantIndex) => variantIndex === index ? { ...entry, sku: event.target.value } : entry) })} /><Field label="Price (USD)" type="number" min="0" step="0.01" required value={variant.price} onChange={(event) => setForm({ ...form, variants: form.variants.map((entry, variantIndex) => variantIndex === index ? { ...entry, price: event.target.value } : entry) })} /></div><div className="mt-3 grid grid-cols-2 gap-3"><Field label="Stock" type="number" min="0" step="1" required value={variant.stock} onChange={(event) => setForm({ ...form, variants: form.variants.map((entry, variantIndex) => variantIndex === index ? { ...entry, stock: event.target.value } : entry) })} /><Field label="Attributes" placeholder="Size=L, Color=Blue" value={variant.attributes} onChange={(event) => setForm({ ...form, variants: form.variants.map((entry, variantIndex) => variantIndex === index ? { ...entry, attributes: event.target.value } : entry) })} /></div></div>)}</div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setForm({ ...form, variants: [...form.variants, blankVariant()] })}>Add another variant</Button>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Create product"}</Button>
        </form>
      </Panel>
      <Panel className="overflow-hidden p-0"><div className="border-b border-line p-5"><h2 className="font-bold">Catalog</h2><p className="mt-1 text-sm text-muted">{products.length} products</p></div><div className="divide-y divide-line">{products.map((product) => <div key={product._id} className="p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="truncate font-semibold">{product.title}</div><div className="mt-1 text-xs text-muted">{product.category} · {product.variants.length} variant(s) · {product.variants.reduce((count, item) => count + item.stock, 0)} in stock</div></div><div className="flex shrink-0 items-center gap-3"><StatusPill>{product.isActive ? "ACTIVE" : "ARCHIVED"}</StatusPill>{product.isActive && <Button variant="quiet" onClick={() => void archiveProduct(product._id)}>Archive</Button>}</div></div><div className="mt-4 space-y-2">{product.variants.map((variant) => <div key={variant.sku} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2.5"><div className="text-sm"><span className="font-semibold">{variant.sku}</span><span className="ml-2 text-muted">${variant.price.toFixed(2)} · {variant.stock} in stock</span></div><div className="flex gap-2"><Button variant="secondary" disabled={busySku === variant.sku} onClick={() => void saveVariants(product, product.variants.map((entry) => entry.sku === variant.sku ? { ...entry, stock: entry.stock + 1 } : entry), variant.sku)}>+ Stock</Button><Button variant="secondary" disabled={busySku === variant.sku || variant.stock === 0} onClick={() => void saveVariants(product, product.variants.map((entry) => entry.sku === variant.sku ? { ...entry, stock: entry.stock - 1 } : entry), variant.sku)}>− Stock</Button><Button variant="quiet" disabled={busySku === variant.sku || product.variants.length === 1} onClick={() => void saveVariants(product, product.variants.filter((entry) => entry.sku !== variant.sku), variant.sku)}>Remove</Button></div></div>)}</div></div>)}{products.length === 0 && <p className="p-8 text-center text-sm text-muted">Your catalog is empty. Add your first product.</p>}</div></Panel>
    </div>
  </>;
}
