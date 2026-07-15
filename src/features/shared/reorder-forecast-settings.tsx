import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ReorderForecastSettings = {
  id: boolean;
  lookback_days: number;
  safety_lead_days: number;
  alert_threshold_percent: number;
  email_enabled: boolean;
};

const DEFAULT_REORDER_FORECAST_SETTINGS: ReorderForecastSettings = {
  id: true,
  lookback_days: 30,
  safety_lead_days: 0,
  alert_threshold_percent: 100,
  email_enabled: true,
};

export function ReorderForecastSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data: savedSettings } = useQuery<ReorderForecastSettings>({
    queryKey: ["reorder-forecast-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("reorder_forecast_settings")
        .select("id, lookback_days, safety_lead_days, alert_threshold_percent, email_enabled")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_REORDER_FORECAST_SETTINGS, ...(data ?? {}) };
    },
  });
  const [draft, setDraft] = useState<ReorderForecastSettings>(DEFAULT_REORDER_FORECAST_SETTINGS);

  useEffect(() => {
    if (savedSettings) setDraft(savedSettings);
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("reorder_forecast_settings").upsert({
        ...draft,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const { error: refreshError } = await (supabase.rpc as any)("refresh_reorder_alerts");
      if (refreshError) throw refreshError;
    },
    onSuccess: async () => {
      toast.success("Reorder forecast rules saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reorder-forecast-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["reorder-alerts"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save reorder forecast rules"),
  });

  const valuesValid = draft.lookback_days >= 7 && draft.lookback_days <= 365
    && draft.safety_lead_days >= 0 && draft.safety_lead_days <= 90
    && draft.alert_threshold_percent >= 25 && draft.alert_threshold_percent <= 200;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Reorder forecasting</CardTitle>
        <CardDescription>Demand is calculated from completed outbound picks. Product min/max, pick-down, and supplier lead-time values drive each alert.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="reorder-lookback-days">Demand look-back days</label>
            <Input id="reorder-lookback-days" type="number" min={7} max={365} value={draft.lookback_days} disabled={!isAdmin} onChange={(event) => setDraft((current) => ({ ...current, lookback_days: Number(event.target.value) }))} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="reorder-safety-days">Safety lead days</label>
            <Input id="reorder-safety-days" type="number" min={0} max={90} value={draft.safety_lead_days} disabled={!isAdmin} onChange={(event) => setDraft((current) => ({ ...current, safety_lead_days: Number(event.target.value) }))} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="reorder-threshold">Alert threshold (%)</label>
            <Input id="reorder-threshold" type="number" min={25} max={200} value={draft.alert_threshold_percent} disabled={!isAdmin} onChange={(event) => setDraft((current) => ({ ...current, alert_threshold_percent: Number(event.target.value) }))} />
          </div>
        </div>
        <label className={cn("flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm", isAdmin ? "cursor-pointer" : "opacity-70")}>
          <Switch checked={draft.email_enabled} disabled={!isAdmin} onCheckedChange={(checked) => setDraft((current) => ({ ...current, email_enabled: checked }))} />
          <span><span className="font-medium">Email eligible recipients</span><span className="block text-xs text-muted-foreground">Send one email to active admins and warehouse managers when a product first enters a reorder state.</span></span>
        </label>
        {isAdmin ? (
          <div className="flex justify-end">
            <Button type="button" disabled={saveMutation.isPending || !valuesValid} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save forecast rules
            </Button>
          </div>
        ) : <p className="text-xs text-muted-foreground">Administrator access is required to change forecasting rules.</p>}
      </CardContent>
    </Card>
  );
}
