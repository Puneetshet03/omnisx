import React from "react";
import type { LucideIcon } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  Operational: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Recovered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  Standby: "bg-slate-100 text-slate-700 border-slate-200",
  Warning: "bg-amber-50 text-amber-700 border-amber-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Disrupted: "bg-red-50 text-red-700 border-red-200",
  Critical: "bg-red-100 text-red-800 border-red-300",
  Recovering: "bg-violet-50 text-violet-700 border-violet-200",
  Low: "bg-sky-50 text-sky-700 border-sky-200",
  Info: "bg-blue-50 text-blue-700 border-blue-200",
  OPTIMAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FEASIBLE: "bg-blue-50 text-blue-700 border-blue-200",
  INFEASIBLE: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "blue",
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "blue" | "purple" | "green" | "amber" | "red" | "cyan";
  onClick?: () => void;
}) {
  const accentMap = {
    blue: "bg-blue-50 text-[#2563EB]",
    purple: "bg-violet-50 text-[#7C3AED]",
    green: "bg-emerald-50 text-[#10B981]",
    amber: "bg-amber-50 text-[#F59E0B]",
    red: "bg-red-50 text-[#EF4444]",
    cyan: "bg-cyan-50 text-[#06B6D4]",
  };

  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{title}</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#0F172A]">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F172A]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[#64748B]">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackMessage?: string },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card border-red-200 bg-red-50/70 p-6 text-center">
          <p className="font-semibold text-red-700">
            {this.props.fallbackMessage || "Component failed to render"}
          </p>
          <p className="mt-1 text-xs text-red-600">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
