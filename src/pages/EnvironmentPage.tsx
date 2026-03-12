import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { Thermometer, Wind, Droplets, Fan, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS, SAFE_THRESHOLDS } from "@/lib/constants";
import { compareDateTimeAsc, compareDateTimeDesc, formatTimeHHMM, isoToday } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { recordEnvironmentReading } from "@/services/farmService";
import type { EnvironmentReading } from "@/types";

type AutomationDecision = {
  houseId: string;
  mode: "cooling" | "heating" | "ventilation" | "standby" | "offline";
  reason: string;
  fanCommand: "ON" | "OFF" | "NO_SIGNAL";
  heaterCommand: "ON" | "OFF" | "NO_SIGNAL";
  coolingPadCommand: "OPEN" | "CLOSE" | "NO_SIGNAL";
};

export const EnvironmentPage = () => {
  const { profile } = useAuth();
  const { data: readings, loading } = useRealtimeCollection<EnvironmentReading>(COLLECTIONS.environmentReadings);
  const DEVICE_OFFLINE_MS = 15 * 60 * 1000;
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [selectedHouseId, setSelectedHouseId] = useState("");
  const [automationRules, setAutomationRules] = useState({
    tempHigh: 30,
    tempLow: 24,
    ammoniaHigh: SAFE_THRESHOLDS.ammoniaHigh
  });

  const [form, setForm] = useState<EnvironmentReading>({
    houseId: "House-A",
    deviceId: "ESP32-A1",
    temperatureC: 29,
    humidity: 60,
    ammoniaPpm: 12,
    fanStatus: true,
    heaterStatus: false,
    recordedAt: `${isoToday()}T00:00:00.000Z`
  });

  const submit = async (): Promise<void> => {
    if (!profile) {
      return;
    }

    try {
      const payload = {
        ...form,
        recordedAt: new Date().toISOString()
      };
      const result = await recordEnvironmentReading(payload, profile.uid);
      toast.success(result.alertIds.length ? "Reading saved with safety alerts" : "Reading saved");
    } catch (error) {
      console.error(error);
      toast.error("Unable to save environment reading");
    }
  };

  const latestByHouse = useMemo(() => {
    const map = new Map<string, EnvironmentReading>();
    [...readings]
      .sort((a, b) => compareDateTimeDesc(a.recordedAt, b.recordedAt))
      .forEach((reading) => {
        if (!map.has(reading.houseId)) {
          map.set(reading.houseId, reading);
        }
      });

    return Array.from(map.values());
  }, [readings]);

  const latestGlobalReading = useMemo(
    () => [...readings].sort((a, b) => compareDateTimeDesc(a.recordedAt, b.recordedAt))[0],
    [readings]
  );

  const tempSeries = useMemo(
    () =>
      [...readings]
        .sort((a, b) => compareDateTimeAsc(a.recordedAt, b.recordedAt))
        .slice(-30)
        .map((row) => ({
          time: formatTimeHHMM(row.recordedAt),
          temperature: row.temperatureC
        })),
    [readings]
  );

  const latestStatusRows = useMemo(
    () =>
      latestByHouse.map((row) => {
        const recordedAtMs = new Date(row.recordedAt).getTime();
        const isOffline = Number.isNaN(recordedAtMs) || Date.now() - recordedAtMs > DEVICE_OFFLINE_MS;
        const healthy =
          row.temperatureC <= SAFE_THRESHOLDS.temperatureHigh &&
          row.temperatureC >= SAFE_THRESHOLDS.temperatureLow &&
          row.ammoniaPpm <= SAFE_THRESHOLDS.ammoniaHigh;

        return {
          ...row,
          healthy,
          isOffline,
          ageMinutes: Number.isNaN(recordedAtMs) ? null : Math.max(Math.floor((Date.now() - recordedAtMs) / 60000), 0)
        };
      }),
    [latestByHouse]
  );

  useEffect(() => {
    if (latestStatusRows.length === 0) {
      setSelectedHouseId("");
      return;
    }
    if (!selectedHouseId || !latestStatusRows.some((row) => row.houseId === selectedHouseId)) {
      setSelectedHouseId(latestStatusRows[0].houseId);
    }
  }, [latestStatusRows, selectedHouseId]);

  const selectedHouseRows = useMemo(
    () =>
      selectedHouseId
        ? [...readings]
            .filter((row) => row.houseId === selectedHouseId)
            .sort((a, b) => compareDateTimeDesc(a.recordedAt, b.recordedAt))
        : [],
    [readings, selectedHouseId]
  );
  const selectedHouseLatest = useMemo(
    () => latestStatusRows.find((row) => row.houseId === selectedHouseId),
    [latestStatusRows, selectedHouseId]
  );
  const selectedTelemetrySeries = useMemo(
    () =>
      [...selectedHouseRows]
        .sort((a, b) => compareDateTimeAsc(a.recordedAt, b.recordedAt))
        .slice(-30)
        .map((row) => ({
          time: formatTimeHHMM(row.recordedAt),
          temperature: row.temperatureC,
          humidity: row.humidity,
          ammonia: row.ammoniaPpm
        })),
    [selectedHouseRows]
  );

  const offlineCount = latestStatusRows.filter((row) => row.isOffline).length;
  const onlineCount = Math.max(latestStatusRows.length - offlineCount, 0);
  const onlineRows = latestStatusRows.filter((row) => !row.isOffline);
  const onlineAvgTemperature =
    onlineRows.length > 0 ? onlineRows.reduce((sum, row) => sum + row.temperatureC, 0) / onlineRows.length : 0;
  const onlineAvgHumidity =
    onlineRows.length > 0 ? onlineRows.reduce((sum, row) => sum + row.humidity, 0) / onlineRows.length : 0;
  const onlineAvgAmmonia =
    onlineRows.length > 0 ? onlineRows.reduce((sum, row) => sum + row.ammoniaPpm, 0) / onlineRows.length : 0;
  const automationDecisions = useMemo<AutomationDecision[]>(
    () =>
      latestStatusRows.map((row) => {
        if (row.isOffline) {
          return {
            houseId: row.houseId,
            mode: "offline",
            reason: "No recent device telemetry",
            fanCommand: "NO_SIGNAL",
            heaterCommand: "NO_SIGNAL",
            coolingPadCommand: "NO_SIGNAL"
          };
        }
        if (row.temperatureC > automationRules.tempHigh) {
          return {
            houseId: row.houseId,
            mode: "cooling",
            reason: `Temperature ${row.temperatureC}°C > ${automationRules.tempHigh}°C`,
            fanCommand: "ON",
            heaterCommand: "OFF",
            coolingPadCommand: "OPEN"
          };
        }
        if (row.temperatureC < automationRules.tempLow) {
          return {
            houseId: row.houseId,
            mode: "heating",
            reason: `Temperature ${row.temperatureC}°C < ${automationRules.tempLow}°C`,
            fanCommand: "OFF",
            heaterCommand: "ON",
            coolingPadCommand: "CLOSE"
          };
        }
        if (row.ammoniaPpm > automationRules.ammoniaHigh) {
          return {
            houseId: row.houseId,
            mode: "ventilation",
            reason: `Ammonia ${row.ammoniaPpm} ppm > ${automationRules.ammoniaHigh} ppm`,
            fanCommand: "ON",
            heaterCommand: "OFF",
            coolingPadCommand: "OPEN"
          };
        }
        return {
          houseId: row.houseId,
          mode: "standby",
          reason: "All readings in safe range",
          fanCommand: row.fanStatus ? "ON" : "OFF",
          heaterCommand: row.heaterStatus ? "ON" : "OFF",
          coolingPadCommand: "CLOSE"
        };
      }),
    [latestStatusRows, automationRules]
  );

  const actionableCommands = automationDecisions.filter((row) =>
    ["cooling", "heating", "ventilation"].includes(row.mode)
  ).length;

  const runAutomation = (): void => {
    if (!automationEnabled) {
      toast.message("Automation is disabled. Enable it to generate equipment actions.");
      return;
    }

    toast.success(
      actionableCommands > 0
        ? `Automation run completed. ${actionableCommands} house action plans generated.`
        : "Automation run completed. All houses are currently within safe limits."
    );
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Environment Monitoring"
        description="Real-time farm house telemetry from ESP32 devices (HTTP/MQTT ingest)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">
              API endpoint: <span className="ml-1 font-mono text-[10px]">/ingestEnvironmentReading</span>
            </Badge>
            <Badge variant={offlineCount > 0 ? "warning" : "success"}>Offline devices: {offlineCount}</Badge>
            <Badge variant="default">
              Live now: {latestGlobalReading ? new Date(latestGlobalReading.recordedAt).toLocaleTimeString() : "no signal"}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Safe Temperature</p>
              <p className="text-lg font-semibold">
                {SAFE_THRESHOLDS.temperatureLow} - {SAFE_THRESHOLDS.temperatureHigh}°C
              </p>
            </div>
            <Thermometer className="text-primary" size={20} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Humidity Range</p>
              <p className="text-lg font-semibold">
                {SAFE_THRESHOLDS.humidityLow} - {SAFE_THRESHOLDS.humidityHigh}%
              </p>
            </div>
            <Droplets className="text-info" size={20} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Max Ammonia</p>
              <p className="text-lg font-semibold">{SAFE_THRESHOLDS.ammoniaHigh} ppm</p>
            </div>
            <Wind className="text-warning" size={20} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Fan Status</p>
              <p className="text-lg font-semibold">Auto from ESP32</p>
            </div>
            <Fan className="text-success" size={20} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Heater Status</p>
              <p className="text-lg font-semibold">Auto from ESP32</p>
            </div>
            <Flame className="text-warning" size={20} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Barn Snapshot (ESP32)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Selected Barn</Label>
              <Select value={selectedHouseId} onChange={(event) => setSelectedHouseId(event.target.value)}>
                <option value="">Select barn</option>
                {latestStatusRows.map((row) => (
                  <option key={`house-${row.houseId}`} value={row.houseId}>
                    {row.houseId}
                  </option>
                ))}
              </Select>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
              <p className="text-xs text-muted-foreground">Active ESP Devices</p>
              <p className="mt-1 text-xl font-semibold">{onlineCount}</p>
              <p className="text-xs text-muted-foreground">Out of {latestStatusRows.length} barns</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
              <p className="text-xs text-muted-foreground">Avg Temp (Online)</p>
              <p className="mt-1 text-xl font-semibold">{onlineRows.length ? `${onlineAvgTemperature.toFixed(1)}°C` : "-"}</p>
              <p className="text-xs text-muted-foreground">Live across connected barns</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
              <p className="text-xs text-muted-foreground">Avg Humidity / Ammonia</p>
              <p className="mt-1 text-xl font-semibold">
                {onlineRows.length ? `${onlineAvgHumidity.toFixed(1)}% / ${onlineAvgAmmonia.toFixed(1)} ppm` : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Real-time environment average</p>
            </div>
          </div>

          {selectedHouseLatest ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Device</p>
                <p className="mt-1 text-base font-semibold">{selectedHouseLatest.deviceId}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Last Update</p>
                <p className="mt-1 text-base font-semibold">{new Date(selectedHouseLatest.recordedAt).toLocaleTimeString()}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedHouseLatest.ageMinutes === null
                    ? "Unknown"
                    : selectedHouseLatest.ageMinutes === 0
                      ? "Just now"
                      : `${selectedHouseLatest.ageMinutes} min ago`}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Temperature</p>
                <p className="mt-1 text-base font-semibold">{selectedHouseLatest.temperatureC}°C</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Humidity</p>
                <p className="mt-1 text-base font-semibold">{selectedHouseLatest.humidity}%</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Ammonia</p>
                <p className="mt-1 text-base font-semibold">{selectedHouseLatest.ammoniaPpm} ppm</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Actuators</p>
                <p className="mt-1 text-base font-semibold">
                  Fan {selectedHouseLatest.fanStatus ? "ON" : "OFF"} · Heater {selectedHouseLatest.heaterStatus ? "ON" : "OFF"}
                </p>
                <Badge variant={selectedHouseLatest.isOffline ? "warning" : selectedHouseLatest.healthy ? "success" : "danger"}>
                  {selectedHouseLatest.isOffline ? "Offline" : selectedHouseLatest.healthy ? "Normal" : "Out of range"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
              {loading
                ? "Waiting for live ESP data..."
                : "No live telemetry detected yet. When ESP pushes readings, barn snapshot will appear here."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Farm Automation Engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>High Temp Trigger (°C)</Label>
              <Input
                type="number"
                value={automationRules.tempHigh}
                onChange={(event) =>
                  setAutomationRules((prev) => ({
                    ...prev,
                    tempHigh: Number(event.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Low Temp Trigger (°C)</Label>
              <Input
                type="number"
                value={automationRules.tempLow}
                onChange={(event) =>
                  setAutomationRules((prev) => ({
                    ...prev,
                    tempLow: Number(event.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ammonia Trigger (ppm)</Label>
              <Input
                type="number"
                value={automationRules.ammoniaHigh}
                onChange={(event) =>
                  setAutomationRules((prev) => ({
                    ...prev,
                    ammoniaHigh: Number(event.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Automation Status</Label>
              <Select
                value={automationEnabled ? "enabled" : "disabled"}
                onChange={(event) => setAutomationEnabled(event.target.value === "enabled")}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
          </div>
          <Button onClick={runAutomation}>Run Automation Plan</Button>

          <Table>
            <TableHead>
              <tr>
                <TH>House</TH>
                <TH>Mode</TH>
                <TH>Reason</TH>
                <TH>Fan</TH>
                <TH>Heater</TH>
                <TH>Cooling Pads</TH>
              </tr>
            </TableHead>
            <TableBody>
              {automationDecisions.length === 0 ? (
                <tr>
                  <TD colSpan={6}>
                    <div className="py-3 text-sm text-muted-foreground">
                      No automation decisions yet. Add live device readings first.
                    </div>
                  </TD>
                </tr>
              ) : null}
              {automationDecisions.map((row) => (
                <tr key={row.houseId}>
                  <TD>{row.houseId}</TD>
                  <TD>
                    <Badge
                      variant={
                        row.mode === "offline"
                          ? "warning"
                          : row.mode === "standby"
                            ? "success"
                            : "danger"
                      }
                    >
                      {row.mode}
                    </Badge>
                  </TD>
                  <TD>{row.reason}</TD>
                  <TD>{row.fanCommand}</TD>
                  <TD>{row.heaterCommand}</TD>
                  <TD>{row.coolingPadCommand}</TD>
                </tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Log Environment Reading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="form-grid">
              <div className="space-y-2">
                <Label>House</Label>
                <Input value={form.houseId} onChange={(event) => setForm((prev) => ({ ...prev, houseId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Device ID</Label>
                <Input value={form.deviceId} onChange={(event) => setForm((prev) => ({ ...prev, deviceId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  value={form.temperatureC}
                  onChange={(event) => setForm((prev) => ({ ...prev, temperatureC: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Humidity (%)</Label>
                <Input
                  type="number"
                  value={form.humidity}
                  onChange={(event) => setForm((prev) => ({ ...prev, humidity: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ammonia (ppm)</Label>
                <Input
                  type="number"
                  value={form.ammoniaPpm}
                  onChange={(event) => setForm((prev) => ({ ...prev, ammoniaPpm: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fan Status</Label>
                <Select
                  value={String(form.fanStatus)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      fanStatus: event.target.value === "true"
                    }))
                  }
                >
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Heater Status</Label>
                <Select
                  value={String(form.heaterStatus)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      heaterStatus: event.target.value === "true"
                    }))
                  }
                >
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </Select>
              </div>
            </div>
            <Button onClick={() => void submit()} disabled={!profile}>
              Submit Reading
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedHouseId ? `${selectedHouseId} Live Trend` : "Temperature Trend"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTelemetrySeries.length > 0 ? (
              <>
                <AreaTrendChart data={selectedTelemetrySeries} xKey="time" yKey="temperature" color="#4ade80" />
                <LineTrendChart data={selectedTelemetrySeries} xKey="time" yKey="humidity" color="#3b82f6" />
              </>
            ) : (
              <AreaTrendChart data={tempSeries} xKey="time" yKey="temperature" color="#4ade80" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest House Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>House</TH>
                <TH>Device</TH>
                <TH>Last Update</TH>
                <TH>Telemetry Age</TH>
                <TH>Temp</TH>
                <TH>Humidity</TH>
                <TH>Ammonia</TH>
                <TH>Fan</TH>
                <TH>Heater</TH>
                <TH>Status</TH>
              </tr>
            </TableHead>
            <TableBody>
              {latestStatusRows.length === 0 ? (
                <tr>
                  <TD colSpan={10}>
                    <div className="py-3 text-sm text-muted-foreground">
                      No incoming device data yet. ESP32 devices are currently offline.
                    </div>
                  </TD>
                </tr>
              ) : null}
              {latestStatusRows.map((row) => (
                <tr key={`${row.houseId}-${row.deviceId}`}>
                  <TD>{row.houseId}</TD>
                  <TD>{row.deviceId}</TD>
                  <TD>{new Date(row.recordedAt).toLocaleString()}</TD>
                  <TD>
                    {row.ageMinutes === null ? "Unknown" : row.ageMinutes === 0 ? "Just now" : `${row.ageMinutes} min ago`}
                  </TD>
                  <TD>{row.temperatureC}°C</TD>
                  <TD>{row.humidity}%</TD>
                  <TD>{row.ammoniaPpm} ppm</TD>
                  <TD>{row.fanStatus ? "On" : "Off"}</TD>
                  <TD>{row.heaterStatus ? "On" : "Off"}</TD>
                  <TD>
                    <Badge variant={row.isOffline ? "warning" : row.healthy ? "success" : "danger"}>
                      {row.isOffline ? "Device Offline" : row.healthy ? "Normal" : "Out of range"}
                    </Badge>
                  </TD>
                </tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
};
