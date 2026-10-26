/**
 * Zero-decimal currencies in PayPal and ISO 4217 standard.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "HUF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/**
 * Three-decimal currencies (rare in PayPal, but standard in ISO 4217).
 */
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function getCurrencyDecimals(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/**
 * Convert string value from PayPal (e.g. "48.00" or "1000") to integer minor units (cents).
 * Never uses floating-point multiplication directly on decimals.
 */
export function toMinorUnits(valueStr: string | number, currency: string = "USD"): number {
  const decimals = getCurrencyDecimals(currency);
  const str = String(valueStr).trim();

  if (!str) return 0;

  const isNegative = str.startsWith("-");
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split(".");
  const wholePart = parts[0] || "0";
  const fractionalPart = parts[1] || "";

  if (decimals === 0) {
    const whole = parseInt(wholePart, 10);
    return isNegative ? -whole : whole;
  }

  const paddedFraction = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const minor = parseInt(wholePart, 10) * Math.pow(10, decimals) + parseInt(paddedFraction, 10);

  return isNegative ? -minor : minor;
}

/**
 * Convert integer minor units back to PayPal standard decimal string (e.g. 4800 -> "48.00").
 */
export function fromMinorUnits(minorUnits: number, currency: string = "USD"): string {
  const decimals = getCurrencyDecimals(currency);
  const isNegative = minorUnits < 0;
  const absMinor = Math.abs(Math.round(minorUnits));

  if (decimals === 0) {
    return `${isNegative ? "-" : ""}${absMinor}`;
  }

  const divisor = Math.pow(10, decimals);
  const whole = Math.floor(absMinor / divisor);
  const fraction = (absMinor % divisor).toString().padStart(decimals, "0");

  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Format money for human-readable UI display.
 */
export function formatMoney(minorUnits: number, currency: string = "USD"): string {
  const code = currency.toUpperCase();
  const value = fromMinorUnits(minorUnits, code);

  try {
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: getCurrencyDecimals(code),
      maximumFractionDigits: getCurrencyDecimals(code),
    }).format(num);
  } catch {
    return `${code} ${value}`;
  }
}

export function addMoney(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

export function subtractMoney(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export function multiplyMoney(minorUnits: number, factor: number): number {
  return Math.round(minorUnits * factor);
}
