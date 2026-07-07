import {
  AccountType,
  LIABILITY_TYPES,
  LedgerKind,
  toCents,
  toMajor,
  type Account,
  type AccountBalance,
  type LedgerKind as LedgerKindT,
} from "@dasd/fin-shared";
import { Button } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AccountInput } from "../api/client";
import { useAccounts, useBalances, useCreateAccount, useUpdateAccount } from "../api/queries";
import { Field, SelectInput, TextInput } from "../components/form";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { Amount, Card, Chip } from "../components/ui";
import { useUiStore } from "../store/ui";

const accountForm = z.object({
  name: z.string().min(1, "Name is required"),
  ledger: LedgerKind,
  type: AccountType,
  currency: z.string().min(1, "Required"),
  openingBalance: z.number({ message: "Enter a number" }),
  institution: z.string().optional(),
});
type AccountForm = z.infer<typeof accountForm>;

function toInput(values: AccountForm): AccountInput {
  return {
    name: values.name,
    ledger: values.ledger,
    type: values.type,
    currency: values.currency,
    openingBalance: toCents(values.openingBalance),
    institution: values.institution || undefined,
  };
}

function AccountDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Account | null;
}) {
  const currency = useUiStore((s) => s.currency);
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountForm),
    defaultValues: editing
      ? {
          name: editing.name,
          ledger: editing.ledger,
          type: editing.type,
          currency: editing.currency,
          openingBalance: toMajor(editing.openingBalance),
          institution: editing.institution ?? "",
        }
      : { name: "", ledger: "personal", type: "checking", currency, openingBalance: 0, institution: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const body = toInput(values);
    if (editing) await update.mutateAsync({ id: editing.id, body });
    else await create.mutateAsync(body);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit account" : "New account"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Name" error={errors.name?.message}>
          <TextInput placeholder="e.g. Checking" {...register("name")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ledger">
            <SelectInput {...register("ledger")}>
              {LedgerKind.options.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Type">
            <SelectInput {...register("type")}>
              {AccountType.options.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Opening balance (${currency})`} error={errors.openingBalance?.message}>
            <TextInput type="number" step="0.01" {...register("openingBalance", { valueAsNumber: true })} />
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            <TextInput {...register("currency")} />
          </Field>
        </div>
        <Field label="Institution" error={errors.institution?.message}>
          <TextInput placeholder="Optional" {...register("institution")} />
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

const LEDGER_LABELS: Record<LedgerKindT, string> = { personal: "Personal", business: "Business" };

export function Accounts() {
  const currency = useUiStore((s) => s.currency);
  const accountsQ = useAccounts();
  const balancesQ = useBalances();
  const update = useUpdateAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const balanceById = useMemo(() => {
    const map = new Map<string, AccountBalance>();
    for (const b of balancesQ.data ?? []) map.set(b.accountId, b);
    return map;
  }, [balancesQ.data]);

  const grouped = useMemo(() => {
    const groups: Record<LedgerKindT, Account[]> = { personal: [], business: [] };
    for (const a of accountsQ.data ?? []) groups[a.ledger].push(a);
    return groups;
  }, [accountsQ.data]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(a: Account) {
    setEditing(a);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Cash, credit, and investment accounts.</p>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} /> Add account
        </Button>
      </div>

      {accountsQ.isLoading ? (
        <Loading />
      ) : accountsQ.isError ? (
        <ErrorState error={accountsQ.error} />
      ) : (accountsQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No accounts yet"
          hint="Add your first account to start tracking balances."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus size={16} /> Add account
            </Button>
          }
        />
      ) : (
        (Object.keys(grouped) as LedgerKindT[])
          .filter((l) => grouped[l].length > 0)
          .map((l) => (
            <section key={l} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {LEDGER_LABELS[l]}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[l].map((a) => {
                  const bal = balanceById.get(a.id);
                  const isLiability = LIABILITY_TYPES.includes(a.type);
                  return (
                    <Card key={a.id} className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {a.name}
                            {a.archived && <span className="ml-2 text-xs text-muted-foreground">(archived)</span>}
                          </span>
                          {a.institution && (
                            <span className="text-xs text-muted-foreground">{a.institution}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(a)}>
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={a.archived ? "Restore" : "Archive"}
                            onClick={() =>
                              update.mutate({ id: a.id, body: { archived: !a.archived } })
                            }
                          >
                            {a.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Chip>{a.type}</Chip>
                        <Amount
                          cents={bal?.balance ?? a.openingBalance}
                          currency={a.currency || currency}
                          colored={isLiability}
                          className="text-lg font-semibold text-foreground"
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))
      )}

      <AccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
    </div>
  );
}
