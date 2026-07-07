import type { AllocationSlice } from "@dasd/fin-shared";
import type { ReactNode } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { CHART, SERIES } from "./theme";

const RAD = Math.PI / 180;

/** Direct percentage label inside each slice — text in ink, not the series color. */
function renderPercent(props: PieLabelRenderProps): ReactNode {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number" ||
    percent < 0.06
  ) {
    return null;
  }
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text
      x={x}
      y={y}
      fill={CHART.ink}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      className="tabular-nums"
    >
      {Math.round(percent * 100)}%
    </text>
  );
}

/** Donut over the categorical palette; direct-labeled with a legend for identity. */
export function AllocationDonut({
  data,
  currency,
  height = 240,
}: {
  data: AllocationSlice[];
  currency: string;
  height?: number;
}) {
  const rows = data.map((s) => ({ name: s.label, value: s.value, key: s.key }));
  return (
    <ResponsiveContainer width="100%" height={height} className="tabular-nums">
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="80%"
          paddingAngle={2}
          stroke={CHART.surface}
          strokeWidth={2}
          label={renderPercent}
          labelLine={false}
          isAnimationActive={false}
        >
          {rows.map((row, i) => (
            <Cell key={row.key} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: CHART.inkSecondary }} className="text-xs">
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
