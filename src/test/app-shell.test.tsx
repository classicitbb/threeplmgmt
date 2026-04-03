import { render, screen } from "@testing-library/react";
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

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only navigation allowed for the current role", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Warehouses")).toBeInTheDocument();
    expect(screen.getAllByText("Help").length).toBeGreaterThan(0);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("keeps the page title compact and uses a dedicated scroll container for body content", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("WMS Lite")).toBeInTheDocument();
    expect(screen.queryByText("2-warehouse, scan-first control room")).not.toBeInTheDocument();

    const bodyScrollRegion = container.querySelector(".overflow-y-auto.px-4.py-4");
    expect(bodyScrollRegion).not.toBeNull();
    expect(bodyScrollRegion?.className).toContain("flex-1");
    expect(bodyScrollRegion?.className).toContain("min-h-0");
  });
});
