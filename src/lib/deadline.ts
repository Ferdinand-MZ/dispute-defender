export type Urgency = "expired" | "critical" | "urgent" | "normal";

const HOUR_MS = 60 * 60 * 1000;

export interface DeadlineStatus {
  urgency: Urgency;
  /** Whole hours left, rounded down. Negative or zero means expired. */
  hoursLeft: number;
  label: string;
}

/** Classify a PayPal seller response deadline. Under 48h is urgent (US2), under 24h critical. */
export function getDeadlineStatus(dueAt: string, now: number = Date.now()): DeadlineStatus {
  const msLeft = new Date(dueAt).getTime() - now;
  const hoursLeft = Math.floor(msLeft / HOUR_MS);

  if (msLeft <= 0) {
    return { urgency: "expired", hoursLeft, label: "Expired" };
  }
  if (hoursLeft < 24) {
    return { urgency: "critical", hoursLeft, label: hoursLeft < 1 ? "Under 1h left" : `${hoursLeft}h left` };
  }
  if (hoursLeft < 48) {
    return { urgency: "urgent", hoursLeft, label: `${hoursLeft}h left` };
  }
  const daysLeft = Math.floor(hoursLeft / 24);
  return { urgency: "normal", hoursLeft, label: `${daysLeft} days left` };
}
