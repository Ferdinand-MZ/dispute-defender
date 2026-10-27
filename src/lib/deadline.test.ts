import { describe, it, expect } from "vitest";
import { getDeadlineStatus } from "./deadline";

const NOW = Date.parse("2026-10-27T00:00:00Z");
const inHours = (h: number) => new Date(NOW + h * 60 * 60 * 1000).toISOString();

describe("getDeadlineStatus", () => {
  it("treats a passed deadline as expired, even by minutes", () => {
    expect(getDeadlineStatus(inHours(-0.4), NOW).urgency).toBe("expired");
    expect(getDeadlineStatus(inHours(0), NOW).urgency).toBe("expired");
  });

  it("marks under 24h as critical and never rounds up", () => {
    expect(getDeadlineStatus(inHours(0.5), NOW)).toMatchObject({ urgency: "critical", label: "Under 1h left" });
    expect(getDeadlineStatus(inHours(23.9), NOW)).toMatchObject({ urgency: "critical", label: "23h left" });
  });

  it("marks 24h to under 48h as urgent", () => {
    expect(getDeadlineStatus(inHours(24), NOW).urgency).toBe("urgent");
    expect(getDeadlineStatus(inHours(47.9), NOW)).toMatchObject({ urgency: "urgent", label: "47h left" });
  });

  it("shows whole days from 48h on", () => {
    expect(getDeadlineStatus(inHours(48), NOW)).toMatchObject({ urgency: "normal", label: "2 days left" });
    expect(getDeadlineStatus(inHours(24 * 7 + 5), NOW).label).toBe("7 days left");
  });
});
