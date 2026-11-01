import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { DemoShopClient, type CatalogItem } from "@/components/demo-shop-client";

export const dynamic = "force-dynamic";

export default async function DemoShopPage() {
  const storeOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));

  // `description` is sent with the order, so it stays word for word.
  const catalog: CatalogItem[] = [
    {
      sku: "WNC-EAR-01",
      name: "Wireless Noise-Canceling Earbuds",
      description: "Scenario S1: Physical good with FedEx tracking & confirmed delivery scan.",
      priceMinor: 4800,
      icon: "earbuds",
      scenario: "S1",
      scenarioNote: "Strong proof, expect fight",
    },
    {
      sku: "CER-LAMP-02",
      name: "Handmade Ceramic Table Lamp",
      description: "Scenario S2: Physical good shipped without delivery scan.",
      priceMinor: 12000,
      icon: "lamp",
      scenario: "S2",
      scenarioNote: "Weak proof, expect refund",
    },
    {
      sku: "LIN-JKT-03",
      name: "100% Pure Linen Summer Jacket",
      description: "Scenario S3: Natural fabric product description on file.",
      priceMinor: 8900,
      icon: "jacket",
      scenario: "S3",
      scenarioNote: "Not as described dispute",
    },
  ];

  return <DemoShopClient catalog={catalog} initialOrders={storeOrders} />;
}
