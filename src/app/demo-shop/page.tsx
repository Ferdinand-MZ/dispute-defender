import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Truck, CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DemoShopPage() {
  const storeOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));

  const catalog = [
    {
      sku: "WNC-EAR-01",
      name: "Wireless Noise-Canceling Earbuds",
      description: "Scenario S1: Physical good with FedEx tracking & confirmed delivery scan.",
      priceMinor: 4800,
      image: "🎧",
      scenario: "S1 (Strong Proof • Recommended to Fight)",
    },
    {
      sku: "CER-LAMP-02",
      name: "Handmade Ceramic Table Lamp",
      description: "Scenario S2: Physical good shipped without delivery scan.",
      priceMinor: 12000,
      image: "🏺",
      scenario: "S2 (Weak Proof • Recommended to Refund)",
    },
    {
      sku: "LIN-JKT-03",
      name: "100% Pure Linen Summer Jacket",
      description: "Scenario S3: Natural fabric product description on file.",
      priceMinor: 8900,
      image: "🧥",
      scenario: "S3 (SNAD • Not as described dispute)",
    },
  ];

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
              <Button className="w-full text-xs font-semibold gap-1.5" variant="default">
                <span>PayPal Sandbox Checkout</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Existing Orders Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Store Orders & Fulfillment Status</h3>
          <span className="text-xs text-muted-foreground">{storeOrders.length} orders on file</span>
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
                <th className="py-2.5 px-4 text-right">Delivery Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {storeOrders.map((order) => (
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
                  <td className="py-3 px-4 text-right text-muted-foreground">
                    {order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : "Pending scan"}
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
