import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TD, TH, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { COLLECTIONS } from "@/lib/constants";
import { formatCurrency, isoToday } from "@/lib/utils";
import { consumeInventoryItems, saveQuotation, updateQuotation } from "@/services/farmService";
import { exportQuotationPdf } from "@/services/quotationExport";
import type { InventoryItem, Quotation, QuotationItem } from "@/types";

const makeQuotationNumber = (): string =>
  `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;

const initialItem = (): QuotationItem => ({
  item: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
  source: "other"
});

export const QuotationsPage = () => {
  const { profile } = useAuth();
  const { data: quotations } = useRealtimeCollection<Quotation>(COLLECTIONS.quotations);
  const { data: inventory } = useRealtimeCollection<InventoryItem>(COLLECTIONS.inventory);

  const [quotationType, setQuotationType] = useState<Quotation["quotationType"]>("chicken_sales");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [validUntil, setValidUntil] = useState(isoToday());
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [deductFromInventory, setDeductFromInventory] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidAt, setPaidAt] = useState(isoToday());
  const [items, setItems] = useState<QuotationItem[]>([initialItem()]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
  const discountAmount = useMemo(() => Number((subtotal * (discountPercent / 100)).toFixed(2)), [discountPercent, subtotal]);
  const taxableAmount = useMemo(() => Math.max(subtotal - discountAmount, 0), [discountAmount, subtotal]);
  const taxAmount = useMemo(() => Number((taxableAmount * (taxPercent / 100)).toFixed(2)), [taxPercent, taxableAmount]);
  const total = useMemo(() => Number((taxableAmount + taxAmount).toFixed(2)), [taxAmount, taxableAmount]);

  const inventoryLookup = useMemo(
    () =>
      inventory.reduce<Record<string, InventoryItem>>((acc, item) => {
        if (item.id) {
          acc[item.id] = item;
        }
        return acc;
      }, {}),
    [inventory]
  );
  const selectableInventory = useMemo(
    () =>
      quotationType === "chicken_sales"
        ? inventory.filter((entry) => entry.category === "livestock")
        : inventory,
    [inventory, quotationType]
  );

  const updateItem = (index: number, patch: Partial<QuotationItem>): void => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = { ...item, ...patch };
        const inventoryItem = next.inventoryItemId ? inventoryLookup[next.inventoryItemId] : undefined;
        const nextItemName = patch.inventoryItemId && inventoryItem ? inventoryItem.name : next.item;

        return {
          ...next,
          item: nextItemName,
          total: Number((next.quantity * next.unitPrice).toFixed(2))
        };
      })
    );
  };

  const submit = async (): Promise<void> => {
    if (
      !profile ||
      !customerName ||
      items.some((row) => !row.item || (row.source === "inventory" && !row.inventoryItemId))
    ) {
      return;
    }

    if (deductFromInventory) {
      const outOfStock = items.find((row) => {
        if (row.source !== "inventory" || !row.inventoryItemId) {
          return false;
        }
        const stock = inventoryLookup[row.inventoryItemId]?.quantity ?? 0;
        return stock < row.quantity;
      });

      if (outOfStock) {
        toast.error("Not enough inventory for one or more selected line items.");
        return;
      }
    }

    const payload: Quotation = {
      quotationNumber: makeQuotationNumber(),
      quotationType,
      customerName,
      customerContact,
      validUntil,
      items,
      subtotal,
      discountPercent,
      taxPercent,
      discountAmount,
      taxAmount,
      discount: discountAmount,
      tax: taxAmount,
      total,
      status: "draft",
      paymentStatus,
      paidAmount: paymentStatus === "paid" ? Number((paidAmount || total).toFixed(2)) : 0,
      paidAt: paymentStatus === "paid" ? paidAt : undefined
    };

    try {
      await saveQuotation(payload, profile.uid);

      if (deductFromInventory) {
        const requests = items
          .filter((row) => row.source === "inventory" && row.inventoryItemId)
          .map((row) => ({
            inventoryItemId: row.inventoryItemId as string,
            quantity: row.quantity
          }));
        if (requests.length > 0) {
          await consumeInventoryItems(requests, profile.uid);
        }
      }

      toast.success("Quotation saved");
      setCustomerName("");
      setCustomerContact("");
      setPaymentStatus("unpaid");
      setPaidAmount(0);
      setPaidAt(isoToday());
      setItems([initialItem()]);
    } catch (error) {
      console.error(error);
      toast.error("Unable to save quotation");
    }
  };

  const updatePaymentStatus = async (quotation: Quotation, nextStatus: "unpaid" | "paid"): Promise<void> => {
    if (!profile || !quotation.id) {
      return;
    }

    try {
      await updateQuotation(
        quotation.id,
        {
          paymentStatus: nextStatus,
          paidAmount:
            nextStatus === "paid"
              ? Number(((quotation.paidAmount && quotation.paidAmount > 0 ? quotation.paidAmount : quotation.total) ?? 0).toFixed(2))
              : 0,
          paidAt: nextStatus === "paid" ? quotation.paidAt ?? isoToday() : undefined
        },
        profile.uid
      );
      toast.success(nextStatus === "paid" ? "Quotation marked as paid" : "Quotation marked as unpaid");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update quotation payment");
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Quotation Generator"
        description="Professional quotation workflow with percentage tax/discount, inventory-linked line items, and branded PDF output."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create Quotation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="form-grid">
            <div className="space-y-2">
              <Label>Quotation Type</Label>
              <Select value={quotationType} onChange={(event) => setQuotationType(event.target.value as Quotation["quotationType"])}>
                <option value="chicken_sales">Chicken Sales</option>
                <option value="farm_supplies">Farm Supplies</option>
                <option value="equipment">Equipment</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Customer Contact</Label>
              <Input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/15 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Line Items</Label>
              <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, initialItem()])}>
                <Plus size={13} className="mr-1" />
                Add Item
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-border/60 bg-card/60 p-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <Label>Source</Label>
                  <Select
                    value={item.source ?? "other"}
                    onChange={(event) =>
                      updateItem(index, {
                        source: event.target.value as QuotationItem["source"],
                        inventoryItemId: event.target.value === "inventory" ? item.inventoryItemId : undefined
                      })
                    }
                  >
                    <option value="other">Other</option>
                    <option value="inventory">Inventory</option>
                  </Select>
                </div>
                <div className="md:col-span-4">
                  <Label>{item.source === "inventory" ? "Inventory Item" : "Description"}</Label>
                  {item.source === "inventory" ? (
                    <Select
                      value={item.inventoryItemId ?? ""}
                      onChange={(event) =>
                        updateItem(index, {
                          inventoryItemId: event.target.value,
                          item: inventoryLookup[event.target.value]?.name ?? item.item
                        })
                      }
                    >
                      <option value="">Select inventory item</option>
                      {selectableInventory.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} ({entry.quantity} {entry.unit})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={item.item} onChange={(event) => updateItem(index, { item: event.target.value })} />
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: Math.max(Number(event.target.value), 0) })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(event) => updateItem(index, { unitPrice: Math.max(Number(event.target.value), 0) })}
                  />
                </div>
                <div className="flex items-end justify-end md:col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-8">
            <div className="space-y-2">
              <Label>Discount (%)</Label>
              <Input type="number" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Tax (%)</Label>
              <Input type="number" value={taxPercent} onChange={(event) => setTaxPercent(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Deduct From Inventory</Label>
              <Select value={String(deductFromInventory)} onChange={(event) => setDeductFromInventory(event.target.value === "true")}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select
                value={paymentStatus}
                onChange={(event) => {
                  const nextStatus = event.target.value as "unpaid" | "paid";
                  setPaymentStatus(nextStatus);
                  if (nextStatus === "paid" && paidAmount <= 0) {
                    setPaidAmount(total);
                  }
                }}
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paid Amount</Label>
              <Input
                type="number"
                disabled={paymentStatus !== "paid"}
                value={paymentStatus === "paid" ? paidAmount : 0}
                onChange={(event) => setPaidAmount(Math.max(Number(event.target.value), 0))}
              />
            </div>
            <div className="space-y-2">
              <Label>Paid Date</Label>
              <Input
                type="date"
                disabled={paymentStatus !== "paid"}
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-3 md:col-span-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(total)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
            <p>Subtotal: {formatCurrency(subtotal)}</p>
            <p>Discount: {discountPercent.toFixed(2)}% ({formatCurrency(discountAmount)})</p>
            <p>Tax: {taxPercent.toFixed(2)}% ({formatCurrency(taxAmount)})</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void submit()} disabled={!profile || !customerName}>
              Save Quotation
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void exportQuotationPdf({
                  quotationNumber: makeQuotationNumber(),
                  quotationType,
                  customerName: customerName || "Preview Customer",
                  customerContact,
                  validUntil,
                  items,
                  subtotal,
                  discountPercent,
                  taxPercent,
                  discountAmount,
                  taxAmount,
                  discount: discountAmount,
                  tax: taxAmount,
                  total,
                  status: "draft",
                  paymentStatus,
                  paidAmount: paymentStatus === "paid" ? Number((paidAmount || total).toFixed(2)) : 0,
                  paidAt: paymentStatus === "paid" ? paidAt : undefined
                })
              }
            >
              Export Preview PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Quotations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <tr>
                <TH>Number</TH>
                <TH>Customer</TH>
                <TH>Type</TH>
                <TH>Valid Until</TH>
                <TH>Total</TH>
                <TH>Status</TH>
                <TH>Payment</TH>
                <TH>Action</TH>
                <TH>PDF</TH>
              </tr>
            </TableHead>
            <TableBody>
              {[...quotations]
                .sort((a, b) => b.validUntil.localeCompare(a.validUntil))
                .map((quotation) => (
                  <tr key={quotation.id}>
                    <TD>{quotation.quotationNumber}</TD>
                    <TD>{quotation.customerName}</TD>
                    <TD className="capitalize">{quotation.quotationType.replace("_", " ")}</TD>
                    <TD>{quotation.validUntil}</TD>
                    <TD>{formatCurrency(quotation.total)}</TD>
                    <TD>
                      <Badge variant={quotation.status === "accepted" ? "success" : "muted"}>{quotation.status}</Badge>
                    </TD>
                    <TD>
                      <div className="space-y-1">
                        <Badge variant={quotation.paymentStatus === "paid" ? "success" : "muted"}>
                          {quotation.paymentStatus === "paid" ? "paid" : "unpaid"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {quotation.paymentStatus === "paid"
                            ? formatCurrency(quotation.paidAmount && quotation.paidAmount > 0 ? quotation.paidAmount : quotation.total)
                            : "0"}
                        </p>
                      </div>
                    </TD>
                    <TD>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void updatePaymentStatus(quotation, quotation.paymentStatus === "paid" ? "unpaid" : "paid")
                        }
                      >
                        {quotation.paymentStatus === "paid" ? "Mark Unpaid" : "Mark Paid"}
                      </Button>
                    </TD>
                    <TD>
                      <Button variant="ghost" size="sm" onClick={() => void exportQuotationPdf(quotation)}>
                        Export
                      </Button>
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
