import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { exportExcelFile } from "@/services/reportExport";
import type { Batch, ExpenseRecord, SaleRecord } from "@/types";

export const ReportsExportsPage = () => {
  const { data: batches } = useRealtimeCollection<Batch>(COLLECTIONS.batches);
  const { data: sales } = useRealtimeCollection<SaleRecord>(COLLECTIONS.sales);
  const { data: expenses } = useRealtimeCollection<ExpenseRecord>(COLLECTIONS.expenses);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Export Center"
        description="Generate operational datasets for auditors, accountants, and management."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Batch Register</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                void (async () => {
                  try {
                    await exportExcelFile("Batches", batches as unknown as Record<string, unknown>[], "batches-export");
                    toast.success("Batch export complete");
                  } catch (error) {
                    console.error(error);
                    toast.error("Unable to export batches");
                  }
                })();
              }}
            >
              Export Batches Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                void (async () => {
                  try {
                    await exportExcelFile("Sales", sales as unknown as Record<string, unknown>[], "sales-export");
                    toast.success("Sales export complete");
                  } catch (error) {
                    console.error(error);
                    toast.error("Unable to export sales");
                  }
                })();
              }}
            >
              Export Sales Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                void (async () => {
                  try {
                    await exportExcelFile("Expenses", expenses as unknown as Record<string, unknown>[], "expenses-export");
                    toast.success("Expense export complete");
                  } catch (error) {
                    console.error(error);
                    toast.error("Unable to export expenses");
                  }
                })();
              }}
            >
              Export Expenses Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
