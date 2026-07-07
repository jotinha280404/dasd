import { formatCentsCompact } from "@dasd/fin-shared";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AllocationBy } from "../api/client";
import {
  useAllocation,
  useBudgetStatuses,
  useCashflow,
  useDashboard,
  useGoalProgress,
  useNetworth,
} from "../api/queries";
import { AllocationDonut } from "../charts/AllocationDonut";
import { ChartTooltip } from "../charts/ChartTooltip";
import {
  budgetStatusColor,
  budgetStatusLabel,
  CHART,
  goalStatusColor,
  NEG,
  POS,
  SERIES,
} from "../charts/theme";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { Amount, Delta, Panel, ProgressBar, StatTile } from "../components/ui";
import { monthLabel, monthYearLabel, pctLabel } from "../lib/format";
import { useUiStore } from "../store/ui";

const axisTick = { fill: CHART.muted, fontSize: 11 } as const;

export function Dashboard() {
  const currency = useUiStore((s) => s.currency);
  const dash = useDashboard();
  const networth = useNetworth();
  const cashflow = useCashflow();
  const [allocBy, setAllocBy] = useState<AllocationBy>("accountType");
  const allocation = useAllocation(allocBy);
  const budgets = useBudgetStatuses();
  const goals = useGoalProgress();

  const series = networth.data ?? [];
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const momDelta = last && prev ? last.net - prev.net : 0;

  const summary = dash.data;
  const investCost = summary ? summary.investmentsValue - summary.investmentsGain : 0;
  const investGainPct = investCost > 0 && summary ? summary.investmentsGain / investCost : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Stat tiles */}
      {dash.isLoading ? (
        <Loading />
      ) : dash.isError ? (
        <ErrorState error={dash.error} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label="Net Worth"
            value={<Amount cents={summary.netWorth} currency={currency} />}
            delta={<Delta cents={momDelta} currency={currency} suffix="MoM" />}
          />
          <StatTile label="Assets" value={<Amount cents={summary.assets} currency={currency} />} />
          <StatTile
            label="Liabilities"
            value={<Amount cents={summary.liabilities} currency={currency} />}
          />
          <StatTile
            label="This-Month Net"
            value={<Amount cents={summary.monthNet} currency={currency} colored />}
            hint={
              <span className="tabular-nums">
                +{formatCentsCompact(summary.monthIncome, currency)} · −
                {formatCentsCompact(summary.monthExpense, currency)}
              </span>
            }
          />
          <StatTile
            label="Investments"
            value={<Amount cents={summary.investmentsValue} currency={currency} />}
            delta={
              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: investGainPct >= 0 ? POS : NEG }}
              >
                {investGainPct >= 0 ? "+" : "−"}
                {pctLabel(Math.abs(investGainPct))} gain
              </span>
            }
          />
        </div>
      ) : null}

      {/* Net worth + Allocation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Net worth over time" className="lg:col-span-2">
          {networth.isLoading ? (
            <Loading />
          ) : networth.isError ? (
            <ErrorState error={networth.error} />
          ) : series.length === 0 ? (
            <EmptyState
              title="No history yet"
              hint="Add transactions to build a net-worth trend."
            />
          ) : (
            <ResponsiveContainer width="100%" height={260} className="tabular-nums">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={monthLabel}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: CHART.axis }}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCentsCompact(v, currency)}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      currency={currency}
                      hideSwatch
                      labelFormatter={(l) => monthYearLabel(String(l))}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  name="Net worth"
                  stroke={SERIES[0]}
                  strokeWidth={2}
                  fill="url(#nwFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          title="Allocation"
          action={
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
              {(["accountType", "assetClass"] as const).map((by) => (
                <button
                  key={by}
                  type="button"
                  onClick={() => setAllocBy(by)}
                  className={
                    allocBy === by
                      ? "rounded bg-surface-2 px-2 py-1 text-foreground"
                      : "px-2 py-1 text-muted-foreground hover:text-foreground"
                  }
                >
                  {by === "accountType" ? "By account" : "By class"}
                </button>
              ))}
            </div>
          }
        >
          {allocation.isLoading ? (
            <Loading />
          ) : allocation.isError ? (
            <ErrorState error={allocation.error} />
          ) : (allocation.data?.length ?? 0) === 0 ? (
            <EmptyState title="Nothing to allocate" />
          ) : (
            <AllocationDonut data={allocation.data ?? []} currency={currency} />
          )}
        </Panel>
      </div>

      {/* Cashflow */}
      <Panel title="Cashflow">
        {cashflow.isLoading ? (
          <Loading />
        ) : cashflow.isError ? (
          <ErrorState error={cashflow.error} />
        ) : (cashflow.data?.length ?? 0) === 0 ? (
          <EmptyState title="No cashflow yet" />
        ) : (
          <ResponsiveContainer width="100%" height={260} className="tabular-nums">
            <BarChart
              data={cashflow.data ?? []}
              barGap={2}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={monthLabel}
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
              />
              <YAxis
                tickFormatter={(v: number) => formatCentsCompact(v, currency)}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                cursor={{ fill: CHART.grid, opacity: 0.4 }}
                content={
                  <ChartTooltip
                    currency={currency}
                    labelFormatter={(l) => monthYearLabel(String(l))}
                  />
                }
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ color: CHART.inkSecondary }} className="text-xs">
                    {value}
                  </span>
                )}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill={POS}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expense"
                name="Expense"
                fill={NEG}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Budgets + Goals minis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Budgets">
          {budgets.isLoading ? (
            <Loading />
          ) : budgets.isError ? (
            <ErrorState error={budgets.error} />
          ) : (budgets.data?.length ?? 0) === 0 ? (
            <EmptyState title="No budgets set" hint="Add budgets on the Budgets page." />
          ) : (
            <ul className="flex flex-col gap-3">
              {(budgets.data ?? []).map((b) => (
                <li key={b.budgetId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{b.categoryName}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span style={{ color: budgetStatusColor(b.pct) }}>
                        {budgetStatusLabel(b.pct)}
                      </span>
                      <Amount cents={b.spent} currency={currency} /> /{" "}
                      <Amount cents={b.limit} currency={currency} />
                    </span>
                  </div>
                  <ProgressBar value={b.pct} color={budgetStatusColor(b.pct)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Goals">
          {goals.isLoading ? (
            <Loading />
          ) : goals.isError ? (
            <ErrorState error={goals.error} />
          ) : (goals.data?.length ?? 0) === 0 ? (
            <EmptyState title="No goals yet" hint="Add goals on the Goals page." />
          ) : (
            <ul className="flex flex-col gap-3">
              {(goals.data ?? []).map((g) => (
                <li key={g.goalId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{g.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{pctLabel(g.pct)}</span>
                      <Amount cents={g.current} currency={currency} /> /{" "}
                      <Amount cents={g.target} currency={currency} />
                    </span>
                  </div>
                  <ProgressBar value={g.pct} color={goalStatusColor(g.pct)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {!dash.isLoading && !summary && !dash.isError && (
        <EmptyState
          title="No data yet"
          hint="Start the finance server to seed a demo, then add accounts and transactions."
        />
      )}
      <p className="text-center text-xs text-muted-foreground">
        Money in {currency}. Values update with the ledger toggle above.
      </p>
    </div>
  );
}
