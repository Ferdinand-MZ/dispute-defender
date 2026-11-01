import { Clock } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { caseStateMeta, recommendationMeta, type Tone } from "@/lib/case-labels";
import { getDeadlineStatus, type Urgency } from "@/lib/deadline";
import { cn } from "@/lib/utils";

const toneVariant: Record<Tone, BadgeVariant> = {
  neutral: "secondary",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

export function CaseStateBadge({ state, className }: { state: string; className?: string }) {
  const meta = caseStateMeta(state);
  return (
    <Badge variant={toneVariant[meta.tone]} dot className={className}>
      {meta.label}
    </Badge>
  );
}

export function RecommendationBadge({
  recommendation,
  strengthScore,
  className,
}: {
  recommendation: string | null;
  strengthScore?: number | null;
  className?: string;
}) {
  if (!recommendation) {
    return <span className={cn("text-sm text-muted-foreground", className)}>Pending</span>;
  }
  const meta = recommendationMeta(recommendation);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Badge variant={toneVariant[meta.tone]}>{meta.label}</Badge>
      {strengthScore !== null && strengthScore !== undefined && (
        <span className="text-xs tabular-nums text-muted-foreground">{strengthScore}% strength</span>
      )}
    </span>
  );
}

const urgencyClass: Record<Urgency, string> = {
  expired: "bg-destructive-soft text-destructive",
  critical: "bg-destructive-soft text-destructive",
  urgent: "bg-warning-soft text-warning",
  normal: "bg-muted text-muted-foreground",
};

/** Seller response deadline as a countdown. Pass `now` from a ticking clock in client components. */
export function DeadlinePill({
  dueAt,
  now,
  className,
}: {
  dueAt: string | null;
  now?: number;
  className?: string;
}) {
  if (!dueAt) return <span className={cn("text-sm text-muted-foreground", className)}>No deadline</span>;
  const status = getDeadlineStatus(dueAt, now);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums leading-5",
        urgencyClass[status.urgency],
        className
      )}
      title={`Respond by ${new Date(dueAt).toUTCString()}`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {status.urgency === "urgent" || status.urgency === "critical" ? `Urgent · ${status.label}` : status.label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-9">{title}</h1>
        {description && <p className="max-w-[65ch] text-sm text-muted-foreground sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
