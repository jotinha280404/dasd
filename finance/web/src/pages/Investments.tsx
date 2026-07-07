import {
  AssetClass,
  toCents,
  toMajor,
  type Account,
  type Holding,
} from "@dasd/fin-shared";
import { Button } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { HoldingInput } from "../api/client";
import {
  useAccounts,
  useAllocation,
  useCreateHolding,
  useDeleteHolding,
  useHoldings,
  useRefreshPrices,
  useUpdateHolding,
} from "../api/queries";
import { AllocationDonut } from "../charts/AllocationDonut";
import { NEG, POS } from "../charts/theme";
import { Field, SelectInput, TextInput } from "../components/form";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { Amount, Card, Chip, Panel } from "../components/ui";
import { pctLabel } from "../lib/format";
import { useUiStore } from "../store/ui";

interface HoldingRow {
  holding: Holding;
  value: number;
  gain: number;
  gainPct: number;
}

const holdingForm = z.object({
  accountId: z.string().min(1, "Select an account"),
  symbol: z.string().min(1, "Required"),
  name: z.string().optional(),
  assetClass: AssetClass,
  quantity: z.number({ message: "Enter a quantity" }),
  costBasis: z.number({ message: "Enter cost basis" }),
  currentPrice: z.number({ message: "Enter a price" }),
});
type HoldingForm = z.infer<typeof holdingForm>;

function HoldingDialog({
  open,
  onClose,
  editing,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  editing: Holding | null;
  accounts: Account[];
}) {
  const currency = useUiStore((s) => s.currency);
  const create = useCreateHolding();
  const update = useUpdateHolding();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HoldingForm>({
    resolver: zodResolver(holdingForm),
    defaultValues: editing
      ? {
          accountId: editing.accountId,
          symbol: editing.symbol,
          name: editing.name ?? "",
          assetClass: editing.assetClass,
          quantity: editing.quantity,
          costBasis: toMajor(editing.costBasis),
          currentPrice: toMajor(editing.currentPrice),
        }
      : {
          accountId: accounts[0]?.id ?? "",
          symbol: "",
          name: "",
          assetClass: "equity",
          quantity: 0,
          costBasis: 0,
          currentPrice: 0,
        },
  });

  const onSubmit = handleSubmit(async (values) => {
    const account = accounts.find((a) => a.id === values.accountId);
    if (!account) return;
    const body: HoldingInput = {
      accountId: values.accountId,
      ledger: account.ledger,
      symbol: values.symbol.toUpperCase(),
      name: values.name || undefined,
      assetClass: values.assetClass,
      quantity: values.quantity,
      costBasis: toCents(values.costBasis),
      currentPrice: toCents(values.currentPrice),
    };
    if (editing) await update.mutateAsync({ id: editing.id, body });
    else await create.mutateAsync(body);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit holding" : "New holding"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Account" error={errors.accountId?.message}>
          <SelectInput {...register("accountId")}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.ledger})
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol" error={errors.symbol?.message}>
            <TextInput placeholder="VOO" {...register("symbol")} />
          </Field>
          <Field label="Asset class">
            <SelectInput {...register("assetClass")}>
              {AssetClass.options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Name" error={errors.name?.message}>
          <TextInput placeholder="Optional" {...register("name")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity" error={errors.quantity?.message}>
            <TextInput type="number" step="any" {...register("quantity", { valueAsNumber: true })} />
          </Field>
          <Field label={`Cost (${currency})`} error={errors.costBasis?.message}>
            <TextInput type="number" step="0.01" {...register("costBasis", { valueAsNumber: true })} />
          </Field>
          <Field label={`Price (${currency})`} error={errors.currentPrice?.message}>
            <TextInput type="number" step="0.01" {...register("currentPrice", { valueAsNumber: true })} />
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {editing ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Investments() {
  const currency = useUiStore((s) => s.currency);
  const holdingsQ = useHoldings();
  const accountsQ = useAccounts();
  const allocation = useAllocation("assetClass");
  const refresh = useRefreshPrices();
  const del = useDeleteHolding();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);

  const investmentAccounts = useMemo(() => {
    const accts = accountsQ.data ?? [];
    const inv = accts.filter((a) => a.type === "investment");
    return inv.length > 0 ? inv : accts;
  }, [accountsQ.data]);

  const rows: HoldingRow[] = useMemo(() => {
    return (holdingsQ.data ?? []).map((h) => {
      const value = Math.round(h.quantity * h.currentPrice);
      const gain = value - h.costBasis;
      const gainPct = h.costBasis > 0 ? gain / h.costBasis : 0;
      return { holding: h, value, gain, gainPct };
    });
  }, [holdingsQ.data]);

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
  const totalGain = rows.reduce((sum, r) => sum + r.gain, 0);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(h: Holding) {
    setEditing(h);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-muted-foreground">Portfolio value</span>
          <Amount cents={totalValue} currency={currency} className="text-lg font-semibold text-foreground" />
          <span className="text-sm tabular-nums" style={{ color: totalGain >= 0 ? POS : NEG }}>
            {totalGain >= 0 ? "+" : "−"}
            <Amount cents={Math.abs(totalGain)} currency={currency} />
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw size={16} className={refresh.isPending ? "animate-spin" : undefined} /> Refresh prices
          </Button>
          <Button size="sm" onClick={openNew} disabled={investmentAccounts.length === 0}>
            <Plus size={16} /> Add holding
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Holdings" className="lg:col-span-2" bodyClassName="overflow-x-auto">
          {holdingsQ.isLoading ? (
            <Loading />
          ) : holdingsQ.isError ? (
            <ErrorState error={holdingsQ.error} />
          ) : rows.length === 0 ? (
            <EmptyState title="No holdings" hint="Add a holding to track your portfolio." />
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Symbol</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Price</th>
                  <th className="py-2 pr-4 text-right font-medium">Value</th>
                  <th className="py-2 pr-4 text-right font-medium">Gain</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ holding: h, value, gain, gainPct }) => (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-foreground">{h.symbol}</span>
                      {h.name && <span className="ml-2 text-xs text-muted-foreground">{h.name}</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <Chip>{h.assetClass}</Chip>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{h.quantity}</td>
                    <td className="py-2 pr-4 text-right">
                      <Amount cents={h.currentPrice} currency={currency} />
                    </td>
                    <td className="py-2 pr-4 text-right text-foreground">
                      <Amount cents={value} currency={currency} />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex flex-col items-end">
                        <Amount cents={gain} currency={currency} colored />
                        <span className="text-xs tabular-nums" style={{ color: gain >= 0 ? POS : NEG }}>
                          {gain >= 0 ? "+" : "−"}
                          {pctLabel(Math.abs(gainPct))}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(h)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del.mutate(h.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="By asset class">
          {allocation.isLoading ? (
            <Loading />
          ) : allocation.isError ? (
            <ErrorState error={allocation.error} />
          ) : (allocation.data?.length ?? 0) === 0 ? (
            <EmptyState title="No allocation" />
          ) : (
            <AllocationDonut data={allocation.data ?? []} currency={currency} />
          )}
        </Panel>
      </div>

      {dialogOpen && (
        <HoldingDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          editing={editing}
          accounts={investmentAccounts}
        />
      )}
    </div>
  );
}
