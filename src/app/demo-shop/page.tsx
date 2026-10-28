import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { DemoShopClient } from "@/components/demo-shop-client";

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

  return <DemoShopClient catalog={catalog} initialOrders={storeOrders} />;
}
