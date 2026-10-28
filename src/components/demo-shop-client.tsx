"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Truck, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CatalogItem {
  sku: string;
  name: string;
  description: string;
  priceMinor: number;
  image: string;
  scenario: string;
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleCheckout(item: CatalogItem) {
    setLoadingSku(item.sku);
    setStatusMessage(null);
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
      setStatusMessage(`Order ${data.orderId} created successfully! Marked as 'paid'.`);
      router.refresh();
    } catch (err) {
      setStatusMessage(`Error creating order: ${(err as Error).message}`);
    } finally {
      setLoadingSku(null);
    }
  }

  async function handleShip(orderId: string) {
    setShippingOrderId(orderId);
    setStatusMessage(null);
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
        ? "Carrier tracking sent to PayPal POST /v1/shipping/trackers-batch!"
        : "Carrier tracking recorded locally (sandbox demo).";
      setStatusMessage(`Order ${orderId} marked as shipped! Tracking: ${data.carrier} ${data.trackingNumber}. ${trackingMsg}`);
      router.refresh();
    } catch (err) {
      setStatusMessage(`Error shipping order: ${(err as Error).message}`);
    } finally {
      setShippingOrderId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Sandbox Demo Storefront
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Demonstrates real PayPal checkout orders linked to merchant shipping tracking and policy fact base.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs bg-muted/30">
          DEMO STORE • SANDBOX ONLY
        </Badge>
      </div>

      {statusMessage && (
        <div className="p-3 bg-primary/10 border border-primary/20 text-primary text-xs rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Catalog Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {catalog.map((item) => (
          <Card key={item.sku} className="flex flex-col justify-between">
            <CardHeader>
              <div className="text-4xl mb-2">{item.image}</div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{item.name}</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] w-fit mt-1">
                {item.scenario}
              </Badge>
              <CardDescription className="mt-2 text-xs leading-relaxed">
                {item.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatMoney(item.priceMinor, "USD")}
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                className="w-full text-xs font-semibold gap-1.5"
                variant="default"
                disabled={loadingSku === item.sku}
                onClick={() => handleCheckout(item)}
              >
                {loadingSku === item.sku ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>PayPal Sandbox Checkout</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Existing Orders Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Store Orders & Fulfillment Status</h3>
          <span className="text-xs text-muted-foreground">{initialOrders.length} orders on file</span>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
              <tr>
                <th className="py-2.5 px-4">Order ID</th>
                <th className="py-2.5 px-4">Buyer</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">Fulfillment Status</th>
                <th className="py-2.5 px-4">Carrier & Tracking</th>
                <th className="py-2.5 px-4">Delivery Date</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialOrders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4 font-mono font-medium text-foreground">{order.id}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{order.buyerName || "Sandbox Buyer"}</div>
                    <div className="text-muted-foreground text-[11px]">{order.buyerEmail}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold">{formatMoney(order.amountMinor, order.currency)}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {order.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    {order.trackingNumber ? (
                      <span className="text-primary font-medium">
                        {order.carrier} • {order.trackingNumber}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : "Pending scan"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {order.status === "paid" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-[11px] h-7 gap-1 font-medium"
                        disabled={shippingOrderId === order.id}
                        onClick={() => handleShip(order.id)}
                      >
                        {shippingOrderId === order.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Truck className="h-3 w-3 text-primary" />
                        )}
                        <span>Mark Shipped & Send Tracking</span>
                      </Button>
                    ) : order.status === "shipped" || order.status === "delivered" ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        Tracking Sent
                      </Badge>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
