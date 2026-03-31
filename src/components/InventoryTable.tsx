import { useState } from "react";
import { Search, Filter, ArrowUpDown, MoreHorizontal, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const mockInventory = [
  { sku: "SKU-40281", product: "Wireless Earbuds Pro", client: "TechVault Inc", location: "A-03-12", qty: 1420, status: "in-stock", lastMoved: "2h ago" },
  { sku: "SKU-40282", product: "USB-C Hub 7-Port", client: "TechVault Inc", location: "A-03-14", qty: 340, status: "in-stock", lastMoved: "5h ago" },
  { sku: "SKU-51090", product: "Organic Green Tea 100ct", client: "PureBrew Co", location: "B-07-02", qty: 85, status: "low-stock", lastMoved: "1d ago" },
  { sku: "SKU-51091", product: "Chamomile Blend 50ct", client: "PureBrew Co", location: "B-07-04", qty: 0, status: "out-of-stock", lastMoved: "3d ago" },
  { sku: "SKU-60014", product: 'Resistance Band Set 12"', client: "FitGear Direct", location: "C-01-08", qty: 2200, status: "in-stock", lastMoved: "30m ago" },
  { sku: "SKU-60015", product: "Yoga Mat Premium 6mm", client: "FitGear Direct", location: "C-01-10", qty: 45, status: "low-stock", lastMoved: "6h ago" },
  { sku: "SKU-70301", product: "Soy Candle - Lavender", client: "Lumière Home", location: "D-02-01", qty: 890, status: "in-stock", lastMoved: "4h ago" },
  { sku: "SKU-70302", product: "Reed Diffuser Set", client: "Lumière Home", location: "D-02-03", qty: 12, status: "low-stock", lastMoved: "2d ago" },
];

const statusConfig = {
  "in-stock": { label: "In Stock", className: "bg-success/15 text-success border-success/20" },
  "low-stock": { label: "Low Stock", className: "bg-warning/15 text-warning border-warning/20" },
  "out-of-stock": { label: "Out of Stock", className: "bg-destructive/15 text-destructive border-destructive/20" },
};

const InventoryTable = () => {
  const [search, setSearch] = useState("");

  const filtered = mockInventory.filter(
    (item) =>
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.product.toLowerCase().includes(search.toLowerCase()) ||
      item.client.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Inventory Overview</h2>
          <span className="text-xs text-muted-foreground font-mono">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search SKU, product, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-64 rounded-md border border-input bg-secondary pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button className="h-8 px-3 rounded-md border border-input bg-secondary text-xs text-secondary-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
            <Filter className="h-3 w-3" /> Filters
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {["SKU", "Product", "Client", "Location", "Qty", "Status", "Last Moved", ""].map((h) => (
                <th key={h} className="text-left font-medium px-4 py-2.5">
                  {h && (
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                      {h} {h && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const status = statusConfig[item.status as keyof typeof statusConfig];
              return (
                <tr
                  key={item.sku}
                  className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-primary font-medium">{item.sku}</td>
                  <td className="px-4 py-2.5 text-foreground">{item.product}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.client}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{item.location}</td>
                  <td className="px-4 py-2.5 font-mono text-foreground font-medium">{item.qty.toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn("text-[10px] font-medium", status.className)}>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.lastMoved}</td>
                  <td className="px-4 py-2.5">
                    <button className="text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryTable;
