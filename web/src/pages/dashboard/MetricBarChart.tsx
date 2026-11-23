import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';

import type { ChartBar, DashboardView } from '../../domain/dashboard';
import type { StatsPeriod } from '../../domain/types';
import styles from './MetricBarChart.module.css';

// 차트 안의 치수(px). SVG 좌표라 CSS 변수로 둘 수 없다. 피그마 Monthly Bar Chart(744 × 300)에서 옮겼다.
/** 막대 너비: 일별(한 달 31칸)은 피그마의 14, 월별(12칸)은 칸이 넓어 더 굵게 */
const BAR_WIDTH: Record<StatsPeriod, number> = { month: 14, year: 32 };
/** 막대 위쪽 모서리 */
const BAR_TOP_RADIUS = 3;
const BAR_RADIUS: [number, number, number, number] = [BAR_TOP_RADIUS, BAR_TOP_RADIUS, 0, 0];
/** 기획: 막대 윤곽 line/black 1px */
const BAR_STROKE_WIDTH = 1;
/** 가장 높은 막대 위에 값 라벨(줄 높이 16)이 들어갈 자리 */
const CHART_MARGIN = { top: 24, right: 0, bottom: 0, left: 0 };
/** 막대와 값 라벨 사이 */
const VALUE_LABEL_OFFSET = 4;
/** 가로 눈금 글자가 들어가는 높이(바닥선 260 → 차트 끝 300) */
const X_AXIS_HEIGHT = 40;
/** 바닥선과 눈금 글자 사이 */
const X_TICK_MARGIN = 8;

function renderTooltip({ active, payload }: TooltipContentProps) {
  const bar: ChartBar | undefined = active ? payload[0]?.payload : undefined;
  // 값이 없는 칸(뛰지 않은 날)에는 도움말을 띄우지 않는다
  if (!bar || bar.valueText == null) return null;
  return (
    <p className={styles.tooltip}>
      {bar.name} · {bar.valueText}
    </p>
  );
}

/**
 * 대시보드의 막대 차트. 기획의 막대 규칙: 막대 primary/default + 1px line/black 윤곽, 값 라벨은 항상 막대 위.
 * 목표선은 긋지 않는다(목표 거리 값이 서버에 없다 — 열린 질문 Q-011).
 */
export default function MetricBarChart({ view, period }: { view: DashboardView; period: StatsPeriod }) {
  // 가로 눈금은 axisLabel이 있는 칸만 적는다(월 차트는 1일과 5의 배수 날짜)
  const axisLabels = new Map(view.bars.map((bar) => [bar.name, bar.axisLabel ?? '']));
  return (
    // 차트는 그림 하나로 읽힌다. 값이 있는 칸만 이름과 함께 읽어 준다.
    <div className={styles.chart} role="img" aria-label={view.chartSummary}>
      <BarChart responsive data={view.bars} margin={CHART_MARGIN} accessibilityLayer={false} className={styles.plot}>
        <XAxis
          dataKey="name"
          interval={0}
          height={X_AXIS_HEIGHT}
          tickMargin={X_TICK_MARGIN}
          tickLine={false}
          axisLine={{ stroke: 'var(--line-regular)' }}
          tickFormatter={(name: string) => axisLabels.get(name) ?? ''}
        />
        <YAxis hide domain={[0, 'dataMax']} />
        <Tooltip content={renderTooltip} cursor={{ fill: 'var(--bg-regular)' }} isAnimationActive={false} />
        <Bar
          dataKey="value"
          barSize={BAR_WIDTH[period]}
          radius={BAR_RADIUS}
          fill="var(--primary-default)"
          stroke="var(--line-black)"
          strokeWidth={BAR_STROKE_WIDTH}
          isAnimationActive={false}
        >
          <LabelList dataKey="valueText" position="top" offset={VALUE_LABEL_OFFSET} />
        </Bar>
      </BarChart>
    </div>
  );
}
