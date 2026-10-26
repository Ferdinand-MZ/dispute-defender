import { describe, it, expect } from "vitest";
import {
  toMinorUnits,
  fromMinorUnits,
  formatMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  getCurrencyDecimals,
} from "./money";

describe("Money Library", () => {
  it("determines correct currency decimals", () => {
    expect(getCurrencyDecimals("USD")).toBe(2);
    expect(getCurrencyDecimals("EUR")).toBe(2);
    expect(getCurrencyDecimals("JPY")).toBe(0);
    expect(getCurrencyDecimals("KRW")).toBe(0);
    expect(getCurrencyDecimals("BHD")).toBe(3);
  });

  it("converts USD decimal strings to minor units without floating point inaccuracies", () => {
    expect(toMinorUnits("48.00", "USD")).toBe(4800);
    expect(toMinorUnits("48.99", "USD")).toBe(4899);
    expect(toMinorUnits("0.01", "USD")).toBe(1);
    expect(toMinorUnits("0.00", "USD")).toBe(0);
    expect(toMinorUnits("120", "USD")).toBe(12000);
    expect(toMinorUnits("-15.50", "USD")).toBe(-1550);
  });

  it("handles zero-decimal currencies like JPY", () => {
    expect(toMinorUnits("1500", "JPY")).toBe(1500);
    expect(toMinorUnits("1500.00", "JPY")).toBe(1500);
    expect(fromMinorUnits(1500, "JPY")).toBe("1500");
  });

  it("converts minor units back to PayPal formatted strings", () => {
    expect(fromMinorUnits(4800, "USD")).toBe("48.00");
    expect(fromMinorUnits(4899, "USD")).toBe("48.99");
    expect(fromMinorUnits(5, "USD")).toBe("0.05");
    expect(fromMinorUnits(0, "USD")).toBe("0.00");
    expect(fromMinorUnits(-500, "USD")).toBe("-5.00");
  });

  it("performs integer-safe arithmetic", () => {
    const a = toMinorUnits("19.99", "USD");
    const b = toMinorUnits("5.01", "USD");
    expect(addMoney(a, b)).toBe(2500);
    expect(subtractMoney(a, b)).toBe(1498);
    expect(multiplyMoney(a, 0.5)).toBe(1000); // 1999 * 0.5 = 999.5 -> rounded to 1000
  });

  it("formats money nicely for UI", () => {
    expect(formatMoney(4800, "USD")).toBe("$48.00");
    expect(formatMoney(1500, "JPY")).toContain("1,500");
  });
});
