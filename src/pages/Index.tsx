import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import KpiCard from "@/components/KpiCard";
import InventoryTable from "@/components/InventoryTable";
import ActivityFeed from "@/components/ActivityFeed";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  MapPin,
  ChevronDown,
  Bell,
  User,
} from "lucide-react";

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState("dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
            <span className="text-xs text-muted-foreground">·</span>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-input px-2.5 py-1 bg-secondary">
              All Clients <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
            </button>
            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total SKUs"
              value="4,992"
              subtitle="Across 4 clients"
              icon={Package}
              trend={{ value: "3.2%", positive: true }}
              variant="info"
            />
            <KpiCard
              title="Inbound Today"
              value="840"
              subtitle="3 POs received"
              icon={ArrowDownToLine}
              trend={{ value: "12%", positive: true }}
              variant="success"
            />
            <KpiCard
              title="Outbound Today"
              value="168"
              subtitle="7 orders shipped"
              icon={ArrowUpFromLine}
              trend={{ value: "5%", positive: false }}
            />
            <KpiCard
              title="Bin Utilization"
              value="73%"
              subtitle="1,204 / 1,648 bins"
              icon={MapPin}
              variant="warning"
            />
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <InventoryTable />
            </div>
            <div>
              <ActivityFeed />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
