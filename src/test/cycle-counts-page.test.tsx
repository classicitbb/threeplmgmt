import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CycleCountsPage } from "@/components/wms-ui";

const networkState = vi.hoisted(() => ({ online: true }));
const authState = vi.hoisted(() => ({
  roles: ["warehouse_operator"],
  profile: { id: "user-1" },
}));
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
  acceptCycleCountExceptionLine: vi.fn(async () => undefined),
  returnCycleCountExceptionLine: vi.fn(async () => undefined),
  closeCycleCount: vi.fn(async () => undefined),
  discardDraftCycleCount: vi.fn(async () => undefined),
  archiveCancelledCycleCount: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    roles: authState.roles,
    profile: authState.profile,
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
    acceptCycleCountExceptionLine: cycleCountMocks.acceptCycleCountExceptionLine,
    returnCycleCountExceptionLine: cycleCountMocks.returnCycleCountExceptionLine,
    closeCycleCount: cycleCountMocks.closeCycleCount,
    discardDraftCycleCount: cycleCountMocks.discardDraftCycleCount,
    archiveCancelledCycleCount: cycleCountMocks.archiveCancelledCycleCount,
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
    authState.roles = ["warehouse_operator"];
    authState.profile = { id: "user-1" };
    cycleCountMocks.listCycleCounts.mockResolvedValue([]);
    cycleCountMocks.listMyCycleCountLines.mockResolvedValue([{
      id: "line-1",
      line_status: "queued",
      products: { sku: "FLOUR", name: "Flour" },
      locations: { code: "A-01-L01" },
    }]);
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

  it("lets developers preview supervisor count controls from a popup with status filters", async () => {
    authState.roles = ["developer"];
    cycleCountMocks.listCycleCounts.mockResolvedValue([{
      id: "count-1",
      count_number: "CCT-108082026122300",
      status: "draft",
      scope: "spot",
      freeze_expires_at: null,
      cycle_count_lines: [],
      inventory_freezes: [],
    }] as never);

    renderCycleCountsPage();

    expect(await screen.findByRole("button", { name: /new count/i })).toBeInTheDocument();
    expect(screen.getByText("All statuses")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new count/i }));

    expect(await screen.findByRole("dialog", { name: /create count/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /freeze and create count/i })).toBeInTheDocument();
  });

  it("keeps role preview developer-only", async () => {
    authState.roles = ["warehouse_manager"];

    renderCycleCountsPage();

    expect(await screen.findByRole("button", { name: /new count/i })).toBeInTheDocument();
    expect(screen.queryByText("Developer")).not.toBeInTheDocument();
  });

  it("shows exception lines in approvals for supervisor action", async () => {
    authState.roles = ["warehouse_supervisor"];
    cycleCountMocks.listCycleCounts.mockResolvedValue([{
      id: "count-1",
      count_number: "CCT-108082026122300",
      status: "review",
      scope: "spot",
      freeze_expires_at: null,
      inventory_freezes: [],
      cycle_count_lines: [{
        id: "line-2",
        line_status: "exception",
        expected_quantity: 10,
        variance_quantity: -10,
        variance_percent: 100,
        exception_reason: "Blocked location",
        products: { sku: "FLOUR", name: "Flour" },
        locations: { code: "A-01-L01" },
      }],
    }] as never);

    renderCycleCountsPage();

    const approvalsTab = await screen.findByRole("tab", { name: /approvals/i });
    fireEvent.mouseDown(approvalsTab);
    fireEvent.click(approvalsTab);

    expect(await screen.findByText(/exception review/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked location/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept exception/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /return to blind entry/i })).toBeDisabled();
  });
});
