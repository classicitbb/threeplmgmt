import { ArrowDownToLine, ArrowUpFromLine, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  { type: "inbound", message: "PO-8821 received — 240 units from TechVault Inc", time: "12m ago", icon: ArrowDownToLine, color: "text-info" },
  { type: "outbound", message: "Order #90421 shipped — FitGear Direct (48 units)", time: "28m ago", icon: ArrowUpFromLine, color: "text-primary" },
  { type: "alert", message: "Low stock alert: Chamomile Blend 50ct (0 units)", time: "1h ago", icon: AlertTriangle, color: "text-warning" },
  { type: "inbound", message: "PO-8819 received — 600 units from Lumière Home", time: "2h ago", icon: ArrowDownToLine, color: "text-info" },
  { type: "complete", message: "Cycle count completed — Zone B verified", time: "3h ago", icon: CheckCircle, color: "text-success" },
  { type: "outbound", message: "Order #90418 shipped — PureBrew Co (120 units)", time: "4h ago", icon: ArrowUpFromLine, color: "text-primary" },
];

const ActivityFeed = () => (
  <div className="bg-card rounded-lg border border-border">
    <div className="px-4 py-3 border-b border-border">
      <h2 className="text-sm font-semibold text-foreground">Activity Feed</h2>
    </div>
    <div className="divide-y divide-border">
      {activities.map((a, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <a.icon className={cn("h-4 w-4 mt-0.5 shrink-0", a.color)} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground leading-relaxed">{a.message}</p>
            <span className="text-[10px] text-muted-foreground font-mono">{a.time}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ActivityFeed;
