import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReceivingPage } from "@/components/wms-ui";

const wmsMocks = vi.hoisted(() => {
  const draft = {
    id: "draft-1",
    receipt_number: "RCT-1",
    reference_number: "PO-1",
    container_number: "CONT-1",
    po_number: "PO-1",
    draft_group_id: "shipment-1",
    draft_pallet_barcode: "PLT-1",
    draft_sequence: 1,
    draft_count: 1,
    warehouse_id: "wh-1",
    client_id: "client-1",
    status: "draft",
    product_id: "prod-1",
    quantity: 1,
    expiry_date: null,
    lot_number: null,
    batch_number: null,
    created_at: "2026-06-05T00:00:00.000Z",
    notes: JSON.stringify({ _draft: true, product_id: "prod-1", quantity: 1, draft_pallet_barcode: "PLT-1", container_number: "CONT-1", po_number: "PO-1" }),
    source_label: null,
  };
  return {
    draft,
    listDraftReceipts: vi.fn(async () => []),
    saveShipmentDrafts: vi.fn(async () => ({ groupId: "shipment-1", draftIds: ["draft-1"], count: 1 })),
    updateDraftReceipt: vi.fn(async () => undefined),
    completeReceiptFromDraft: vi.fn(async () => ({ palletBarcode: "PLT-1", putawayTaskNumber: "PTA-1" })),
  };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = vi.fn();

vi.mock("@/components/pallet-label-page", () => ({
  PalletLabelPage: ({ trigger, onPrinted }: { trigger?: React.ReactNode; onPrinted?: () => void }) => {
    const element = React.isValidElement(trigger) ? trigger : <button>Print label</button>;
    return React.cloneElement(element as React.ReactElement<any>, {
      onClick: () => onPrinted?.(),
    });
  },
}));

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
    listDraftReceipts: wmsMocks.listDraftReceipts,
    saveShipmentDrafts: wmsMocks.saveShipmentDrafts,
    updateDraftReceipt: wmsMocks.updateDraftReceipt,
    completeReceiptFromDraft: wmsMocks.completeReceiptFromDraft,
  };
});

describe("ReceivingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wmsMocks.listDraftReceipts.mockResolvedValue([]);
  });

  function renderReceivingPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReceivingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return queryClient;
  }

  it("opens the new shipment modal with visible form content", async () => {
    renderReceivingPage();

    fireEvent.click(await screen.findByRole("button", { name: /new shipment/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("New Shipment")).toBeInTheDocument();
    expect(screen.getByText("Container number")).toBeInTheDocument();
    expect(screen.getByText("SKU line 1")).toBeInTheDocument();
  });

  it("saves a shipment draft and opens the print dialog for Save & Receive", async () => {
    wmsMocks.listDraftReceipts.mockResolvedValue([wmsMocks.draft]);
    renderReceivingPage();

    fireEvent.click(await screen.findByRole("button", { name: /new shipment/i }));
    const dialog = await screen.findByRole("dialog");
    const textboxes = within(dialog).getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "CONT-1" } });
    fireEvent.change(textboxes[1], { target: { value: "PO-1" } });
    fireEvent.click(within(dialog).getAllByRole("combobox")[1]);
    const productMatches = await screen.findAllByText(/FLOUR/i);
    fireEvent.click(productMatches[productMatches.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: /save & receive/i }));

    await waitFor(() => expect(wmsMocks.saveShipmentDrafts).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Print Draft Labels")).toBeInTheDocument();
    expect(screen.getAllByText(/PLT-1/).length).toBeGreaterThan(0);
  });

  it("printing a draft row completes receiving and sends it to putaway", async () => {
    wmsMocks.listDraftReceipts.mockResolvedValue([wmsMocks.draft]);
    renderReceivingPage();

    fireEvent.click(await screen.findByRole("button", { name: /print & receive/i }));

    await waitFor(() => expect(wmsMocks.completeReceiptFromDraft).toHaveBeenCalledWith("draft-1", expect.objectContaining({
      pallet_barcode: "PLT-1",
      product_id: "prod-1",
      quantity: 1,
    })));
  });
});
