import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ReceivingPage } from "@/components/wms-ui";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: { default_warehouse_id: "wh-1" },
    roles: ["warehouse_manager"],
  }),
}));

vi.mock("@/lib/wms-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wms-core")>();
  return {
    ...actual,
    fetchOptions: vi.fn(async () => ({
      warehouses: [{ id: "wh-1", name: "NEW - New Warehouse" }],
      clients: [{ id: "client-1", code: "RH", name: "Russell Hunte" }],
      products: [{ id: "prod-1", sku: "FLOUR", name: "Flour", barcode: "FLOUR" }],
      packagingProfiles: [],
    })),
    listDraftReceipts: vi.fn(async () => []),
  };
});

describe("ReceivingPage", () => {
  it("opens the new shipment modal with visible form content", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReceivingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /new shipment/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("New Shipment")).toBeInTheDocument();
    expect(screen.getByText("Container number")).toBeInTheDocument();
    expect(screen.getByText("SKU line 1")).toBeInTheDocument();
  });
});
