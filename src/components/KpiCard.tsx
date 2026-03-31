import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "success" | "warning" | "info";
}

const variantStyles = {
  default: "border-border",
  success: "border-l-2 border-l-success border-t-0 border-r-0 border-b-0",
  warning: "border-l-2 border-l-warning border-t-0 border-r-0 border-b-0",
  info: "border-l-2 border-l-info border-t-0 border-r-0 border-b-0",
};

const KpiCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: KpiCardProps) => (
  <div className={cn("bg-card rounded-lg border p-4 space-y-2", variantStyles[variant])}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex items-end gap-2">
      <span className="text-2xl font-semibold font-mono text-foreground">{value}</span>
      {trend && (
        <span className={cn("text-xs font-mono mb-1", trend.positive ? "text-success" : "text-destructive")}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </span>
      )}
    </div>
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
  </div>
);

export default KpiCard;
