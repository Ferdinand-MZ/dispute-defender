"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { humanizeEnum } from "@/lib/case-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/case-status";
import { CircleAlert, CircleCheck, Headphones, Lamp, Loader2, Shirt, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface CatalogItem {
  sku: string;
  name: string;
  description: string;
  priceMinor: number;
  icon: "earbuds" | "lamp" | "jacket";
  scenario: string;
  scenarioNote: string;
}

interface OrderItem {
  id: string;
  paypalOrderId: string | null;
  captureId: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

const ICONS = { earbuds: Headphones, lamp: Lamp, jacket: Shirt };

// Fixed locale and UTC so server and browser render identical text.
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const STEPS = [
  { title: "Buy a product", body: "Creates a captured PayPal Sandbox order." },
  { title: "Ship it", body: "Adds FedEx tracking and sends it to PayPal." },
  { title: "Open a dispute", body: "Use the Simulator with the order ID." },
];

function statusVariant(status: string) {
  if (status === "delivered") return "success" as const;
  if (status === "shipped") return "info" as const;
  return "secondary" as const;
}

export function DemoShopClient({
  catalog,
  initialOrders,
}: {
  catalog: CatalogItem[];
  initialOrders: OrderItem[];
}) {
  const router = useRouter();
  const [loadingSku, setLoadingSku] = useState<string | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleCheckout(item: CatalogItem) {
    setLoadingSku(item.sku);
    setStatus(null);
    try {
      const res = await fetch("/api/demo-shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          sku: item.sku,
          priceMinor: item.priceMinor,
          description: item.description,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to place demo order");
      }

      const data = await res.json();
      setStatus({ ok: true, text: `Order ${data.orderId} is paid. Ship it next so PayPal gets the tracking.` });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: `Couldn't create the order: ${(err as Error).message}` });
    } finally {
      setLoadingSku(null);
    }
  }

  async function handleShip(orderId: string) {
    setShippingOrderId(orderId);
    setStatus(null);
    try {
      const res = await fetch("/api/demo-shop/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          carrier: "FEDEX",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to ship order");
      }

      const data = await res.json();
      const trackingMsg = data.trackingSubmitted
        ? "Tracking sent to PayPal."
        : "Tracking saved locally (sandbox demo).";
      setStatus({ ok: true, text: `Order ${orderId} shipped with ${data.carrier} ${data.trackingNumber}. ${trackingMsg}` });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: `Couldn't ship the order: ${(err as Error).message}` });
    } finally {
      setShippingOrderId(null);
    }
  }

  const shipButton = (order: OrderItem, className?: string) =>
    order.status === "paid" ? (
      <Button
        size="sm"
        variant="secondary"
        className={className}
        disabled={shippingOrderId === order.id}
        onClick={() => handleShip(order.id)}
      >
        {shippingOrderId === order.id ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Truck className="h-4 w-4" aria-hidden="true" />
        )}
        {shippingOrderId === order.id ? "Shipping…" : "Ship with tracking"}
      </Button>
    ) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demo store"
        description="Create real PayPal Sandbox orders to dispute later. Nothing here charges real money."
      />

      <ol className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-sm text-muted-foreground">
                {i === 2 ? (
                  <>
                    Use the{" "}
                    <Link href="/admin/simulate" className="font-medium text-primary hover:underline">
                      Simulator
                    </Link>{" "}
                    with the order ID.
                  </>
                ) : (
                  step.body
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {status && (
        <p
          role={status.ok ? "status" : "alert"}
          className={cn(
            "flex items-start gap-2 rounded-xl p-4 text-sm font-medium",
            status.ok ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
          )}
        >
          {status.ok ? (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {status.text}
        </p>
      )}

      <section aria-labelledby="products" className="space-y-3">
        <h2 id="products" className="text-lg font-semibold text-foreground">
          Products
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.sku} className="flex flex-col rounded-xl border bg-card">
                <div className="flex h-32 items-center justify-center rounded-t-xl bg-accent/70">
                  <Icon className="h-14 w-14 text-navy" strokeWidth={1.25} aria-hidden="true" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-medium text-foreground">{item.name}</h3>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                    {formatMoney(item.priceMinor, "USD")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  <p className="mb-4 mt-3 text-xs font-medium text-muted-foreground">
                    {item.scenario} · {item.scenarioNote}
                  </p>
                  <Button
                    className="mt-auto w-full"
                    disabled={loadingSku === item.sku}
                    onClick={() => handleCheckout(item)}
                  >
                    {loadingSku === item.sku && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {loadingSku === item.sku ? "Placing order…" : "Buy with PayPal Sandbox"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="orders" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="orders" className="text-lg font-semibold text-foreground">
            Orders
          </h2>
          <span className="text-sm text-muted-foreground">{initialOrders.length} on file</span>
        </div>

        {initialOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            No orders yet. Buy a product above to create one.
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted text-[13px] font-semibold text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">Order</th>
                    <th scope="col" className="px-4 py-3">Buyer</th>
                    <th scope="col" className="px-4 py-3 text-right">Amount</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Tracking</th>
                    <th scope="col" className="px-4 py-3">Delivered</th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {initialOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{order.id}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{order.buyerName || "Sandbox buyer"}</div>
                        <div className="text-xs text-muted-foreground">{order.buyerEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatMoney(order.amountMinor, order.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(order.status)}>{humanizeEnum(order.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {order.trackingNumber ? (
                          `${order.carrier} ${order.trackingNumber}`
                        ) : (
                          <span className="font-sans text-sm text-muted-foreground">Not shipped</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.deliveredAt ? dateFormat.format(new Date(order.deliveredAt)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{shipButton(order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone and tablet */}
            <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {initialOrders.map((order) => (
                <li key={order.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
                      <p className="mt-0.5 font-medium text-foreground">{order.buyerName || "Sandbox buyer"}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatMoney(order.amountMinor, order.currency)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={statusVariant(order.status)}>{humanizeEnum(order.status)}</Badge>
                    {order.trackingNumber && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {order.carrier} {order.trackingNumber}
                      </span>
                    )}
                  </div>
                  {shipButton(order, "mt-3 w-full")}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
