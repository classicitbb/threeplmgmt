import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  MapPin,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Warehouse,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Package, label: "Inventory", id: "inventory" },
  { icon: ArrowDownToLine, label: "Inbound", id: "inbound" },
  { icon: ArrowUpFromLine, label: "Outbound", id: "outbound" },
  { icon: MapPin, label: "Locations", id: "locations" },
  { icon: Users, label: "Clients", id: "clients" },
  { icon: BarChart3, label: "Reports", id: "reports" },
  { icon: Settings, label: "Settings", id: "settings" },
];

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const AppSidebar = ({ activeSection, onSectionChange }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 h-screen sticky top-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
        <Warehouse className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-sidebar-accent-foreground text-sm tracking-wide truncate">
            WMS · 3PL
          </span>
        )}
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {navItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
};

export default AppSidebar;
