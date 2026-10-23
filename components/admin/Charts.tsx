// Лёгкие SVG-графики без зависимостей. Подсказки при наведении — нативные <title>.

export type Series = { key: string; label: string; color: string };

export function StackedBars({
  data,
  series,
  height = 220,
  unit = "",
}: {
  data: { label: string; values: Record<string, number> }[];
  series: Series[];
  height?: number;
  unit?: string;
}) {
  const W = 720;
  const pad = { top: 8, right: 4, bottom: 24, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(28, slot * 0.62));
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const labelEvery = Math.ceil(data.length / 10);

  return (
    <div className="a-chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Столбчатая диаграмма">
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.left - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={pad.left + slot * i + slot / 2} y={height - 6} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </g>
        {data.map((d, i) => {
          const x = pad.left + slot * i + (slot - barW) / 2;
          let acc = 0;
          const segs = series
            .map((s) => ({ s, v: d.values[s.key] ?? 0 }))
            .filter((x) => x.v > 0);
          return (
            <g key={i} className="col">
              <title>
                {d.label}: {totals[i]}
                {unit}
                {segs.map((x) => `\n${x.s.label}: ${x.v}${unit}`).join("")}
              </title>
              <rect className="hit" x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} />
              {segs.map(({ s, v }, j) => {
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const isTop = j === segs.length - 1;
                const h = Math.max(1, y0 - y1 - (isTop ? 0 : 2));
                return isTop ? (
                  <path key={s.key} className="bar" fill={s.color} d={roundedTop(x, y1, barW, h, Math.min(4, barW / 2, h))} />
                ) : (
                  <rect key={s.key} className="bar" fill={s.color} x={x} y={y1 + 2} width={barW} height={h} />
                );
              })}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="a-legend">
          {series.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function HBars({ rows, format = (v: number) => String(v) }: { rows: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="a-empty">Нет данных за период</div>;
  return (
    <div className="a-hbar">
      {rows.map((r) => (
        <div key={r.label} className="a-hbar-row" title={`${r.label}: ${format(r.value)}`}>
          <span>{r.label}</span>
          <div className="a-hbar-track">
            <div className="a-hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="v">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
