import {
  type Account,
  type Category,
  type Transaction,
  TxnType,
  toCents,
  toMajor,
} from "@dasd/fin-shared";
import { Button } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { TransactionInput } from "../api/client";
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useImportTransactions,
  useTransactions,
  useUpdateTransaction,
} from "../api/queries";
import { controlClass, Field, SelectInput, TextInput } from "../components/form";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { Amount, Card, Chip } from "../components/ui";
import { todayIso } from "../lib/format";
import { useUiStore } from "../store/ui";

const txnForm = z.object({
  accountId: z.string().min(1, "Select an account"),
  date: z.string().min(1, "Required"),
  type: TxnType,
  amount: z.number({ message: "Enter an amount" }),
  categoryId: z.string().optional(),
  payee: z.string().optional(),
  note: z.string().optional(),
});
type TxnForm = z.infer<typeof txnForm>;

function TxnDialog({
  open,
  onClose,
  editing,
  accounts,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  accounts: Account[];
  categories: Category[];
}) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const currency = useUiStore((s) => s.currency);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TxnForm>({
    resolver: zodResolver(txnForm),
    defaultValues: editing
      ? {
          accountId: editing.accountId,
          date: editing.date,
          type: editing.type,
          amount: Math.abs(toMajor(editing.amount)),
          categoryId: editing.categoryId ?? "",
          payee: editing.payee ?? "",
          note: editing.note ?? "",
        }
      : {
          accountId: accounts[0]?.id ?? "",
          date: todayIso(),
          type: "expense",
          amount: 0,
          categoryId: "",
          payee: "",
          note: "",
        },
  });

  const onSubmit = handleSubmit(async (values) => {
    const account = accounts.find((a) => a.id === values.accountId);
    if (!account) return;
    const cents = toCents(Math.abs(values.amount));
    const signed = values.type === "income" ? cents : -cents;
    const body: TransactionInput = {
      accountId: values.accountId,
      ledger: account.ledger,
      date: values.date,
      type: values.type,
      amount: signed,
      categoryId: values.categoryId ? values.categoryId : null,
      payee: values.payee || undefined,
      note: values.note || undefined,
      transferAccountId: null,
    };
    if (editing) await update.mutateAsync({ id: editing.id, body });
    else await create.mutateAsync(body);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit transaction" : "New transaction"}>
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
          <Field label="Date" error={errors.date?.message}>
            <TextInput type="date" {...register("date")} />
          </Field>
          <Field label="Type">
            <SelectInput {...register("type")}>
              {TxnType.options.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Amount (${currency})`} error={errors.amount?.message}>
            <TextInput type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
          </Field>
          <Field label="Category">
            <SelectInput {...register("categoryId")}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Payee" error={errors.payee?.message}>
          <TextInput placeholder="Optional" {...register("payee")} />
        </Field>
        <Field label="Note" error={errors.note?.message}>
          <TextInput placeholder="Optional" {...register("note")} />
        </Field>
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

function ImportDialog({
  open,
  onClose,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
}) {
  const importMut = useImportTransactions();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    if (!accountId) {
      setResult("Choose an account first.");
      return;
    }
    const csv = await file.text();
    try {
      const res = await importMut.mutateAsync({ accountId, csv });
      setResult(`Imported ${res.created} transaction${res.created === 1 ? "" : "s"}.`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import CSV">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Header row: <code className="text-foreground">date,amount,description,category</code>.
          Positive amounts are inflows, negatives are outflows.
        </p>
        <Field label="Import into account">
          <SelectInput value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.ledger})
              </option>
            ))}
          </SelectInput>
        </Field>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className={
            controlClass +
            " py-1.5 file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-foreground"
          }
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {result && <p className="text-xs text-foreground">{result}</p>}
        <div className="mt-1 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Transactions() {
  const currency = useUiStore((s) => s.currency);
  const txnsQ = useTransactions();
  const accountsQ = useAccounts();
  const categoriesQ = useCategories();
  const del = useDeleteTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [text, setText] = useState("");

  const accounts = accountsQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (txnsQ.data ?? [])
      .filter((t) => (accountFilter ? t.accountId === accountFilter : true))
      .filter((t) => (categoryFilter ? t.categoryId === categoryFilter : true))
      .filter((t) => (from ? t.date >= from : true))
      .filter((t) => (to ? t.date <= to : true))
      .filter((t) =>
        q
          ? (t.payee ?? "").toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q)
          : true,
      )
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [txnsQ.data, accountFilter, categoryFilter, from, to, text]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(t: Transaction) {
    setEditing(t);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setImportOpen(true)}
            disabled={accounts.length === 0}
          >
            <Upload size={16} /> Import CSV
          </Button>
          <Button size="sm" onClick={openNew} disabled={accounts.length === 0}>
            <Plus size={16} /> Add
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="flex flex-wrap items-end gap-3">
        <Field label="Account" className="min-w-40 flex-1">
          <SelectInput value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Category" className="min-w-40 flex-1">
          <SelectInput value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="From" className="w-36">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" className="w-36">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Search" className="min-w-40 flex-1">
          <TextInput
            placeholder="Payee or note"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </Card>

      {txnsQ.isLoading ? (
        <Loading />
      ) : txnsQ.isError ? (
        <ErrorState error={txnsQ.error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No transactions"
          hint={
            (txnsQ.data?.length ?? 0) > 0
              ? "No rows match the filters."
              : "Add one or import a CSV."
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Payee</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                    {t.date}
                  </td>
                  <td className="px-4 py-2 text-foreground">{t.payee ?? "—"}</td>
                  <td className="px-4 py-2">
                    {t.categoryId ? (
                      <Chip>{categoryName.get(t.categoryId) ?? "—"}</Chip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {accountName.get(t.accountId) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Amount cents={t.amount} currency={currency} colored />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        onClick={() => del.mutate(t.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {dialogOpen && (
        <TxnDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          editing={editing}
          accounts={accounts}
          categories={categories}
        />
      )}
      {importOpen && (
        <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} accounts={accounts} />
      )}
    </div>
  );
}
