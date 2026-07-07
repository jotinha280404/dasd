import { type Account, type Goal, toCents, toMajor } from "@dasd/fin-shared";
import { Button } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { GoalInput } from "../api/client";
import {
  useAccounts,
  useCreateGoal,
  useDeleteGoal,
  useGoalProgress,
  useGoals,
  useUpdateGoal,
} from "../api/queries";
import { goalStatusColor } from "../charts/theme";
import { Field, SelectInput, TextInput } from "../components/form";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { Amount, Card, ProgressBar } from "../components/ui";
import { pctLabel } from "../lib/format";
import { useUiStore } from "../store/ui";

const goalForm = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number({ message: "Enter a target" }).positive("Must be positive"),
  currentAmount: z.number({ message: "Enter an amount" }),
  deadline: z.string().optional(),
  linkedAccountId: z.string().optional(),
});
type GoalForm = z.infer<typeof goalForm>;

function GoalDialog({
  open,
  onClose,
  editing,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  editing: Goal | null;
  accounts: Account[];
}) {
  const currency = useUiStore((s) => s.currency);
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GoalForm>({
    resolver: zodResolver(goalForm),
    defaultValues: editing
      ? {
          name: editing.name,
          targetAmount: toMajor(editing.targetAmount),
          currentAmount: toMajor(editing.currentAmount),
          deadline: editing.deadline ?? "",
          linkedAccountId: editing.linkedAccountId ?? "",
        }
      : { name: "", targetAmount: 0, currentAmount: 0, deadline: "", linkedAccountId: "" },
  });

  const linked = watch("linkedAccountId");

  const onSubmit = handleSubmit(async (values) => {
    const body: GoalInput = {
      name: values.name,
      targetAmount: toCents(values.targetAmount),
      currentAmount: toCents(values.currentAmount),
      deadline: values.deadline ? values.deadline : null,
      linkedAccountId: values.linkedAccountId ? values.linkedAccountId : null,
      ledger: null,
    };
    if (editing) await update.mutateAsync({ id: editing.id, body });
    else await create.mutateAsync(body);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit goal" : "New goal"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Name" error={errors.name?.message}>
          <TextInput placeholder="e.g. Emergency fund" {...register("name")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Target (${currency})`} error={errors.targetAmount?.message}>
            <TextInput
              type="number"
              step="0.01"
              {...register("targetAmount", { valueAsNumber: true })}
            />
          </Field>
          <Field label={`Saved (${currency})`} error={errors.currentAmount?.message}>
            <TextInput
              type="number"
              step="0.01"
              disabled={!!linked}
              {...register("currentAmount", { valueAsNumber: true })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline" error={errors.deadline?.message}>
            <TextInput type="date" {...register("deadline")} />
          </Field>
          <Field label="Linked account">
            <SelectInput {...register("linkedAccountId")}>
              <option value="">None (manual)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        {linked && (
          <p className="text-xs text-muted-foreground">
            Progress tracks the linked account balance; “saved” is ignored.
          </p>
        )}
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

function ContributeDialog({
  open,
  onClose,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
}) {
  const currency = useUiStore((s) => s.currency);
  const update = useUpdateGoal();
  const [amount, setAmount] = useState("");

  async function onAdd() {
    if (!goal) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) return;
    await update.mutateAsync({
      id: goal.id,
      body: { currentAmount: goal.currentAmount + toCents(value) },
    });
    setAmount("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Contribute to ${goal?.name ?? "goal"}`}>
      <div className="flex flex-col gap-3">
        <Field label={`Amount (${currency})`}>
          <TextInput
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onAdd} disabled={update.isPending}>
            Add contribution
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Goals() {
  const currency = useUiStore((s) => s.currency);
  const progressQ = useGoalProgress();
  const goalsQ = useGoals();
  const accountsQ = useAccounts();
  const del = useDeleteGoal();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);

  const goalById = useMemo(() => new Map((goalsQ.data ?? []).map((g) => [g.id, g])), [goalsQ.data]);
  const progress = progressQ.data ?? [];

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(goalId: string) {
    setEditing(goalById.get(goalId) ?? null);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Savings goals and their progress.</p>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} /> Add goal
        </Button>
      </div>

      {progressQ.isLoading ? (
        <Loading />
      ) : progressQ.isError ? (
        <ErrorState error={progressQ.error} />
      ) : progress.length === 0 ? (
        <EmptyState title="No goals yet" hint="Create a goal to start tracking progress." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {progress.map((g) => {
            const raw = goalById.get(g.goalId);
            const linked = !!raw?.linkedAccountId;
            return (
              <Card key={g.goalId} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{g.name}</span>
                  <div className="flex items-center gap-1">
                    {!linked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Contribute"
                        onClick={() => raw && setContributeGoal(raw)}
                      >
                        <PlusCircle size={14} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit"
                      onClick={() => openEdit(g.goalId)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={() => del.mutate(g.goalId)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <Amount
                    cents={g.current}
                    currency={currency}
                    className="text-lg font-semibold text-foreground"
                  />
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {pctLabel(g.pct)}
                  </span>
                </div>
                <ProgressBar value={g.pct} color={goalStatusColor(g.pct)} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    of <Amount cents={g.target} currency={currency} />
                  </span>
                  {g.deadline && <span>by {g.deadline}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <GoalDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          editing={editing}
          accounts={accountsQ.data ?? []}
        />
      )}
      {contributeGoal && (
        <ContributeDialog
          open={!!contributeGoal}
          onClose={() => setContributeGoal(null)}
          goal={contributeGoal}
        />
      )}
    </div>
  );
}
