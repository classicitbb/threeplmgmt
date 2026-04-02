import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createDefaultWarehouseSetupPayload,
  runWarehouseSetup,
  type TemperatureClass,
  type WarehouseLocationTemplate,
  type WarehouseSetupPayload,
  type WarehouseSetupWarehouse,
  type WarehouseSetupZone,
} from "@/lib/wms-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const steps = [
  "Warehouses",
  "Zones",
  "Location Rules",
  "Review",
  "Create",
] as const;

function temperatureOptions(): TemperatureClass[] {
  return ["ambient", "cool", "frozen"];
}

export default function SetupWizardPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [payload, setPayload] = useState<WarehouseSetupPayload>(createDefaultWarehouseSetupPayload());

  const mutation = useMutation({
    mutationFn: async () => runWarehouseSetup(payload),
    onSuccess: async () => {
      toast.success("Warehouse setup completed and starter data seeded.");
      await Promise.all([
        queryClient.invalidateQueries(),
      ]);
      setStep(0);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Setup failed"),
  });

  const totals = useMemo(
    () => ({
      warehouses: payload.warehouses.length,
      zones: payload.zones.length,
      locationTemplates: payload.locationTemplates.length,
    }),
    [payload],
  );

  const updateWarehouse = (index: number, field: keyof WarehouseSetupWarehouse, value: string | boolean) => {
    setPayload((current) => ({
      ...current,
      warehouses: current.warehouses.map((warehouse, warehouseIndex) =>
        warehouseIndex === index ? { ...warehouse, [field]: value } : warehouse,
      ),
    }));
  };

  const updateZone = (index: number, field: keyof WarehouseSetupZone, value: string | boolean | number) => {
    setPayload((current) => ({
      ...current,
      zones: current.zones.map((zone, zoneIndex) => (zoneIndex === index ? { ...zone, [field]: value } : zone)),
    }));
  };

  const updateTemplate = (index: number, field: keyof WarehouseLocationTemplate, value: string | boolean | number) => {
    setPayload((current) => ({
      ...current,
      locationTemplates: current.locationTemplates.map((template, templateIndex) =>
        templateIndex === index ? { ...template, [field]: value } : template,
      ),
    }));
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((label, index) => (
          <Badge key={label} variant={index === step ? "default" : "secondary"}>
            {index + 1}. {label}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Warehouse Setup Wizard</CardTitle>
          <CardDescription>
            Build the warehouse structure, then seed starter operational data so receiving, putaway, picking, transfers,
            and counts can be tested immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {step === 0 ? (
            <div className="grid gap-4">
              {payload.warehouses.map((warehouse, index) => (
                <Card key={`${warehouse.code}-${index}`}>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                    <Field label="Code">
                      <Input value={warehouse.code} onChange={(event) => updateWarehouse(index, "code", event.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Name">
                      <Input value={warehouse.name} onChange={(event) => updateWarehouse(index, "name", event.target.value)} />
                    </Field>
                    <Field label="City">
                      <Input value={warehouse.city} onChange={(event) => updateWarehouse(index, "city", event.target.value)} />
                    </Field>
                    <Field label="Country">
                      <Input value={warehouse.country} onChange={(event) => updateWarehouse(index, "country", event.target.value)} />
                    </Field>
                    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 md:col-span-2">
                      <Label htmlFor={`warehouse-cool-${index}`}>Has cool zone</Label>
                      <Switch
                        id={`warehouse-cool-${index}`}
                        checked={warehouse.hasCoolZone}
                        onCheckedChange={(checked) => updateWarehouse(index, "hasCoolZone", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setPayload((current) => ({
                    ...current,
                    warehouses: [
                      ...current.warehouses,
                      { code: `WH${current.warehouses.length + 1}`, name: "New Warehouse", city: "Bridgetown", country: "Barbados", hasCoolZone: false },
                    ],
                  }))
                }
              >
                <Plus data-icon="inline-start" />
                Add warehouse
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              {payload.zones.map((zone, index) => (
                <Card key={`${zone.warehouseCode}-${zone.code}-${index}`}>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Warehouse">
                      <Select value={zone.warehouseCode} onValueChange={(value) => updateZone(index, "warehouseCode", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {payload.warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.code} value={warehouse.code}>{warehouse.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Code">
                      <Input value={zone.code} onChange={(event) => updateZone(index, "code", event.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Name">
                      <Input value={zone.name} onChange={(event) => updateZone(index, "name", event.target.value)} />
                    </Field>
                    <Field label="Temperature">
                      <Select value={zone.temperatureClass} onValueChange={(value) => updateZone(index, "temperatureClass", value as TemperatureClass)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {temperatureOptions().map((temperature) => (
                            <SelectItem key={temperature} value={temperature}>{temperature}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Sort order">
                      <Input type="number" value={zone.sortOrder} onChange={(event) => updateZone(index, "sortOrder", Number(event.target.value))} />
                    </Field>
                    <div className="grid gap-3 rounded-lg border border-border p-4 xl:col-span-3">
                      <ToggleRow label="Staging zone" checked={zone.isStaging} onCheckedChange={(checked) => updateZone(index, "isStaging", checked)} />
                      <ToggleRow label="Dispatch zone" checked={zone.isDispatch} onCheckedChange={(checked) => updateZone(index, "isDispatch", checked)} />
                      <ToggleRow label="Quarantine zone" checked={zone.isQuarantine} onCheckedChange={(checked) => updateZone(index, "isQuarantine", checked)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setPayload((current) => ({
                    ...current,
                    zones: [
                      ...current.zones,
                      {
                        warehouseCode: current.warehouses[0]?.code ?? "MAIN",
                        code: `ZONE${current.zones.length + 1}`,
                        name: "New Zone",
                        temperatureClass: "ambient",
                        isStaging: false,
                        isDispatch: false,
                        isQuarantine: false,
                        sortOrder: (current.zones.length + 1) * 10,
                      },
                    ],
                  }))
                }
              >
                <Plus data-icon="inline-start" />
                Add zone
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4">
              {payload.locationTemplates.map((template, index) => (
                <Card key={`${template.warehouseCode}-${template.zoneCode}-${index}`}>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Warehouse">
                      <Select value={template.warehouseCode} onValueChange={(value) => updateTemplate(index, "warehouseCode", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {payload.warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.code} value={warehouse.code}>{warehouse.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Zone">
                      <Select value={template.zoneCode} onValueChange={(value) => updateTemplate(index, "zoneCode", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {payload.zones
                            .filter((zone) => zone.warehouseCode === template.warehouseCode)
                            .map((zone) => (
                              <SelectItem key={`${zone.warehouseCode}-${zone.code}`} value={zone.code}>{zone.code}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Location type">
                      <Input value={template.locationType} onChange={(event) => updateTemplate(index, "locationType", event.target.value)} />
                    </Field>
                    <Field label="Temperature">
                      <Select value={template.temperatureClass} onValueChange={(value) => updateTemplate(index, "temperatureClass", value as TemperatureClass)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {temperatureOptions().map((temperature) => (
                            <SelectItem key={temperature} value={temperature}>{temperature}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Aisles">
                      <Input type="number" value={template.aisleCount} onChange={(event) => updateTemplate(index, "aisleCount", Number(event.target.value))} />
                    </Field>
                    <Field label="Bays per aisle">
                      <Input type="number" value={template.baysPerAisle} onChange={(event) => updateTemplate(index, "baysPerAisle", Number(event.target.value))} />
                    </Field>
                    <Field label="Levels">
                      <Input type="number" value={template.levels} onChange={(event) => updateTemplate(index, "levels", Number(event.target.value))} />
                    </Field>
                    <Field label="Max pallets">
                      <Input type="number" value={template.maxPallets} onChange={(event) => updateTemplate(index, "maxPallets", Number(event.target.value))} />
                    </Field>
                    <Field label="Status">
                      <Input value={template.status} onChange={(event) => updateTemplate(index, "status", event.target.value)} />
                    </Field>
                    <div className="grid gap-3 rounded-lg border border-border p-4 xl:col-span-3">
                      <ToggleRow label="Allow mixed SKU" checked={template.mixedSkuAllowed} onCheckedChange={(checked) => updateTemplate(index, "mixedSkuAllowed", checked)} />
                      <ToggleRow label="Allow mixed lot" checked={template.mixedLotAllowed} onCheckedChange={(checked) => updateTemplate(index, "mixedLotAllowed", checked)} />
                    </div>
                    <Button
                      variant="ghost"
                      className="justify-start xl:col-span-3"
                      onClick={() =>
                        setPayload((current) => ({
                          ...current,
                          locationTemplates: current.locationTemplates.filter((_, templateIndex) => templateIndex !== index),
                        }))
                      }
                    >
                      <Trash2 data-icon="inline-start" />
                      Remove template
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setPayload((current) => ({
                    ...current,
                    locationTemplates: [
                      ...current.locationTemplates,
                      {
                        warehouseCode: current.warehouses[0]?.code ?? "MAIN",
                        zoneCode: current.zones[0]?.code ?? "STG",
                        aisleCount: 1,
                        baysPerAisle: 6,
                        levels: 1,
                        maxPallets: 1,
                        locationType: "rack",
                        temperatureClass: "ambient",
                        mixedSkuAllowed: false,
                        mixedLotAllowed: false,
                        status: "active",
                      },
                    ],
                  }))
                }
              >
                <Plus data-icon="inline-start" />
                Add location template
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <SummaryCard title="Warehouses" value={totals.warehouses} description="Facilities that will be created or updated." />
              <SummaryCard title="Zones" value={totals.zones} description="Operational and storage areas defined across those facilities." />
              <SummaryCard title="Location Rules" value={totals.locationTemplates} description="Generation templates used to create physical locations." />
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Review Payload</CardTitle>
                  <CardDescription>Confirm that warehouse codes match across warehouses, zones, and location rules.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm text-muted-foreground">
                  {payload.warehouses.map((warehouse) => (
                    <div key={warehouse.code} className="rounded-lg border border-border p-4">
                      <p className="font-medium text-foreground">{warehouse.code} · {warehouse.name}</p>
                      <p>{warehouse.city}, {warehouse.country}</p>
                      <p className="mt-2">
                        Zones: {payload.zones.filter((zone) => zone.warehouseCode === warehouse.code).map((zone) => zone.code).join(", ") || "None"}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create and Seed</CardTitle>
                  <CardDescription>
                    This will create the warehouse structure and seed starter operational data using the wizard payload.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <p className="text-sm text-muted-foreground">
                    Starter data includes clients, products, packaging profiles, initial pallets, inventory, putaway work,
                    pick work, transfer work, cycle counts, labels, and audit history.
                  </p>
                  <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                    {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                    Create warehouse structure and seed starter data
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || mutation.isPending}>
              Back
            </Button>
            <Button onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))} disabled={step === steps.length - 1 || mutation.isPending}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SummaryCard({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
