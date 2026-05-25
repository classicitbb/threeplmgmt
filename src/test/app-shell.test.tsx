import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/wms-ui";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: { full_name: "Alex Manager" },
    roles: ["warehouse_manager"],
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  STARTER_MODULES: {
    receiving: true,
    putaway: true,
    inventory: true,
    "location-moves": true,
    transfers: true,
    "pick-lists": true,
    products: true,
    warehouses: true,
    zones: true,
    locations: true,
    users: true,
    settings: true,
    clients: true,
    packaging: true,
    "cycle-counts": true,
    reports: true,
    status: true,
    "system-log": true,
    "email-log": true,
  },
  useFeatureFlags: () => ({
    isEnabled: () => true,
  }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAppShell = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell>
            <div>Content</div>
          </AppShell>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("shows only navigation allowed for the current role", () => {
    renderAppShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Warehouses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Help").length).toBeGreaterThan(0);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("keeps the page title compact and uses a dedicated scroll container for body content", () => {
    const { container } = renderAppShell();

    expect(screen.getByText("Warehouse Wizard Enterprise WMS")).toBeInTheDocument();
    expect(screen.queryByText("2-warehouse, scan-first control room")).not.toBeInTheDocument();

    const bodyScrollRegion = container.querySelector(".overflow-y-auto.px-4");
    expect(bodyScrollRegion).not.toBeNull();
    expect(bodyScrollRegion?.className).toContain("flex-1");
    expect(bodyScrollRegion?.className).toContain("min-h-0");
  });
});
