import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CycleCountsPage } from "@/components/wms-ui";

const networkState = vi.hoisted(() => ({ online: true }));
const cycleCountMocks = vi.hoisted(() => ({
  fetchOptions: vi.fn(async () => ({
    warehouses: [{ id: "wh-1", name: "Main Warehouse" }],
    zones: [],
    locations: [{ id: "loc-1", code: "A-01-L01" }],
    products: [{ id: "prod-1", sku: "FLOUR", name: "Flour" }],
    profiles: [{ id: "user-1", full_name: "Warehouse Manager" }],
  })),
  listCycleCounts: vi.fn(async () => []),
  listMyCycleCountLines: vi.fn(async () => ([{
    id: "line-1",
    line_status: "queued",
    products: { sku: "FLOUR", name: "Flour" },
    locations: { code: "A-01-L01" },
  }])),
  createCycleCountFlow: vi.fn(async () => ({ claimed_line_count: 1 })),
  submitCycleCountLine: vi.fn(async () => undefined),
  flagCycleCountLineException: vi.fn(async () => undefined),
  approveCycleCountLine: vi.fn(async () => undefined),
  rejectCycleCountLine: vi.fn(async () => undefined),
  closeCycleCount: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    roles: ["warehouse_operator"],
    profile: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-network-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-network-status")>();
  return {
    ...actual,
    useNetworkStatus: () => ({ online: networkState.online }),
    assertOnline: () => {
      if (!networkState.online) {
        throw new Error(actual.OFFLINE_WORK_MESSAGE);
      }
    },
  };
});

vi.mock("@/lib/wms-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wms-core")>();
  return {
    ...actual,
    fetchOptions: cycleCountMocks.fetchOptions,
    listCycleCounts: cycleCountMocks.listCycleCounts,
    listMyCycleCountLines: cycleCountMocks.listMyCycleCountLines,
    createCycleCountFlow: cycleCountMocks.createCycleCountFlow,
    submitCycleCountLine: cycleCountMocks.submitCycleCountLine,
    flagCycleCountLineException: cycleCountMocks.flagCycleCountLineException,
    approveCycleCountLine: cycleCountMocks.approveCycleCountLine,
    rejectCycleCountLine: cycleCountMocks.rejectCycleCountLine,
    closeCycleCount: cycleCountMocks.closeCycleCount,
  };
});

function renderCycleCountsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CycleCountsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, ...result };
}

describe("CycleCountsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    networkState.online = true;
    window.localStorage.clear();
  });

  it("restores typed blind-count quantities from local resume storage", async () => {
    const firstRender = renderCycleCountsPage();

    const qtyInput = await screen.findByLabelText("Count quantity");
    fireEvent.change(qtyInput, { target: { value: "12" } });

    firstRender.unmount();
    renderCycleCountsPage();

    expect(await screen.findByDisplayValue("12")).toBeInTheDocument();
  });

  it("freezes blind-count posting while offline", async () => {
    networkState.online = false;
    renderCycleCountsPage();

    expect(await screen.findByText(/this device is offline\. cycle-count posts are frozen\./i)).toBeInTheDocument();

    const qtyInput = await screen.findByLabelText("Count quantity");
    fireEvent.change(qtyInput, { target: { value: "8" } });

    expect(screen.getByRole("button", { name: /submit blind count/i })).toBeDisabled();
    expect(cycleCountMocks.submitCycleCountLine).not.toHaveBeenCalled();
  });
});
