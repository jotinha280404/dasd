import { LedgerKind, toCents, toMajor, type Budget, type Category } from "@dasd/fin-shared";
import { Button } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { BudgetInput } from "../api/client";
import {
  useBudgets,
  useBudgetStatuses,
  useCategories,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from "../api/queries";
import { budgetStatusColor, budgetStatusLabel } from "../charts/theme";
import { Field, SelectInput, TextInput } from "../components/form";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { Amount, Card, ProgressBar } from "../components/ui";
import { pctLabel } from "../lib/format";
import { useUiStore } from "../store/ui";

const budgetForm = z.object({
  categoryId: z.string().min(1, "Select a category"),
  ledger: LedgerKind,
  limit: z.number({ message: "Enter a limit" }).positive("Must be positive"),
});
type BudgetForm = z.infer<typeof budgetForm>;

function BudgetDialog({
  open,
  onClose,
  editing,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Budget | null;
  categories: Category[];
}) {
  const currency = useUiStore((s) => s.currency);
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetForm>({
    resolver: zodResolver(budgetForm),
    defaultValues: editing
      ? { categoryId: editing.categoryId, ledger: editing.ledger, limit: toMajor(editing.limit) }
      : { categoryId: expenseCategories[0]?.id ?? "", ledger: "personal", limit: 0 },
  });

  const onSubmit = handleSubmit(async (values) => {
    const body: BudgetInput = {
      categoryId: values.categoryId,
      ledger: values.ledger,
      limit: toCents(values.limit),
      period: "monthly",
    };
    if (editing) await update.mutateAsync({ id: editing.id, body });
    else await create.mutateAsync(body);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit budget" : "New budget"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Category" error={errors.categoryId?.message}>
          <SelectInput {...register("categoryId")}>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
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
          <Field label={`Monthly limit (${currency})`} error={errors.limit?.message}>
            <TextInput type="number" step="0.01" {...register("limit", { valueAsNumber: true })} />
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

export function Budgets() {
  const currency = useUiStore((s) => s.currency);
  const statusesQ = useBudgetStatuses();
  const budgetsQ = useBudgets();
  const categoriesQ = useCategories();
  const del = useDeleteBudget();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const budgetById = useMemo(
    () => new Map((budgetsQ.data ?? []).map((b) => [b.id, b])),
    [budgetsQ.data],
  );

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(budgetId: string) {
    setEditing(budgetById.get(budgetId) ?? null);
    setDialogOpen(true);
  }

  const statuses = statusesQ.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">This month’s spend against each budget.</p>
        <Button size="sm" onClick={openNew} disabled={(categoriesQ.data?.length ?? 0) === 0}>
          <Plus size={16} /> Add budget
        </Button>
      </div>

      {statusesQ.isLoading ? (
        <Loading />
      ) : statusesQ.isError ? (
        <ErrorState error={statusesQ.error} />
      ) : statuses.length === 0 ? (
        <EmptyState title="No budgets yet" hint="Add a monthly limit on an expense category." />
      ) : (
        <div className="flex flex-col gap-3">
          {statuses.map((s) => (
            <Card key={s.budgetId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{s.categoryName}</span>
                  <span className="text-xs" style={{ color: budgetStatusColor(s.pct) }}>
                    {budgetStatusLabel(s.pct)} · {pctLabel(s.pct)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(s.budgetId)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del.mutate(s.budgetId)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <ProgressBar value={s.pct} color={budgetStatusColor(s.pct)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  <Amount cents={s.spent} currency={currency} /> of{" "}
                  <Amount cents={s.limit} currency={currency} />
                </span>
                <span>
                  {s.remaining >= 0 ? (
                    <>
                      <Amount cents={s.remaining} currency={currency} /> left
                    </>
                  ) : (
                    <span style={{ color: budgetStatusColor(s.pct) }}>
                      <Amount cents={-s.remaining} currency={currency} /> over
                    </span>
                  )}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {dialogOpen && (
        <BudgetDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          editing={editing}
          categories={categoriesQ.data ?? []}
        />
      )}
    </div>
  );
}
