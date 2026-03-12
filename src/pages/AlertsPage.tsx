import { useState } from "react";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { markAlertRead } from "@/services/farmService";
import type { Alert } from "@/types";

export const AlertsPage = () => {
  const { profile } = useAuth();
  const { data: alerts } = useRealtimeCollection<Alert>(COLLECTIONS.alerts);
  const [filter, setFilter] = useState<"all" | Alert["type"]>("all");

  const filtered = alerts.filter((alert) => (filter === "all" ? true : alert.type === filter));

  const read = async (alertId: string): Promise<void> => {
    if (!profile) {
      return;
    }

    try {
      await markAlertRead(alertId, profile.uid);
    } catch (error) {
      console.error(error);
      toast.error("Unable to mark alert as read");
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Alerts & Notifications"
        description="Centralized warning center for mortality, feed, market, and environment events."
        actions={
          <Select value={filter} onChange={(event) => setFilter(event.target.value as "all" | Alert["type"])}>
            <option value="all">All alerts</option>
            <option value="mortality">Mortality</option>
            <option value="feed">Feed</option>
            <option value="temperature">Temperature</option>
            <option value="market">Market</option>
            <option value="inventory">Inventory</option>
          </Select>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Alert Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Title</TH>
                <TH>Type</TH>
                <TH>Severity</TH>
                <TH>Message</TH>
                <TH>Status</TH>
                <TH>Action</TH>
              </tr>
            </TableHead>
            <TableBody>
              {filtered
                .sort((a, b) => {
                  const aDate = (a.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
                  const bDate = (b.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
                  return bDate - aDate;
                })
                .map((alert) => (
                  <tr key={alert.id}>
                    <TD>{alert.title}</TD>
                    <TD>
                      <Badge variant="muted">{alert.type}</Badge>
                    </TD>
                    <TD>
                      <Badge
                        variant={
                          alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "success"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </TD>
                    <TD>{alert.message}</TD>
                    <TD>
                      <Badge variant={alert.read ? "success" : "warning"}>{alert.read ? "Read" : "Unread"}</Badge>
                    </TD>
                    <TD>
                      {!alert.read ? (
                        <Button variant="ghost" size="sm" onClick={() => void read(alert.id!)}>
                          Mark read
                        </Button>
                      ) : (
                        "-"
                      )}
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
