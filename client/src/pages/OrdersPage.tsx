import { useEffect, useState } from "react";
import { api, errorMessage } from "../services/api";
import type { Order } from "../types";
import { Button, PageTitle, Panel, StatusPill } from "../components/ui";

export function OrdersPage({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState("");
  async function loadOrders() {
    const { data } = await api.get<{ orders: Order[] }>("/orders");
    setOrders(data.orders);
  }
  useEffect(() => { loadOrders().catch((requestError: unknown) => setError(errorMessage(requestError))); }, []);

  async function updateStatus(orderId: string, status: string, itemId: string, vendorId: string) {
    setBusyItem(itemId);
    setError("");
    try {
      await api.patch(`/orders/${orderId}/fulfillment`, { status, itemId, ...(isSuperAdmin ? { vendorId } : {}) });
      await loadOrders();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusyItem("");
    }
  }

  return <>
    <PageTitle
      title={isSuperAdmin ? "Marketplace orders" : "Fulfillment queue"}
      description={isSuperAdmin ? "Review marketplace orders and platform commission." : "Process orders containing your vendor's items."}
    />
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="space-y-4">{orders.map((order) => <Panel key={order._id}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="font-semibold">Order #{order._id.slice(-8).toUpperCase()}</p>
          <p className="mt-1 text-xs text-muted">{new Date(order.createdAt).toLocaleString()} · {order.customer.name}</p>
          {order.isSimulated && <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Simulated</span>}
        </div>
        <div className="text-right">
          <StatusPill>{order.paymentStatus}</StatusPill>
          <p className="mt-2 text-sm font-semibold">${order.totalAmount.toFixed(2)} {isSuperAdmin ? "gross sales" : "vendor gross"}</p>
          {isSuperAdmin && <p className="mt-1 text-xs text-muted">${order.totalCommission.toFixed(2)} platform commission</p>}
        </div>
      </div>
      <div className="space-y-3">{order.items.map((item) => {
        const next = item.fulfillmentStatus === "PENDING" ? "PROCESSING" : item.fulfillmentStatus === "PROCESSING" ? "SHIPPED" : item.fulfillmentStatus === "SHIPPED" ? "DELIVERED" : undefined;
        return <div key={item._id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted">
              {item.variantSku} · Qty {item.quantity} · ${item.totalPrice.toFixed(2)}
              {isSuperAdmin ? ` · Vendor ${item.vendorId.slice(-8).toUpperCase()} · $${item.commissionFee.toFixed(2)} fee` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill>{item.fulfillmentStatus}</StatusPill>
            {next && <Button variant="secondary" disabled={busyItem === item._id} onClick={() => void updateStatus(order._id, next, item._id, item.vendorId)}>Mark {next.toLowerCase()}</Button>}
          </div>
        </div>;
      })}</div>
    </Panel>)}{orders.length === 0 && <Panel><p className="py-8 text-center text-sm text-muted">No orders to display.</p></Panel>}</div>
  </>;
}
