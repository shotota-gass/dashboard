"use client";

import { useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  sub?: string;
  icon?: React.ReactNode;
  trend?: number | null;
  accentColor?: string;
  animate?: boolean;
}

function AnimatedNumber({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);

  return <span ref={ref}>0</span>;
}

export default function StatCard({
  title,
  value,
  sub,
  icon,
  trend,
  animate = true,
}: StatCardProps) {
  const isNumeric = typeof value === "number";

  const trendEl =
    trend != null ? (
      <div
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
          trend > 0
            ? "bg-black text-white"
            : trend < 0
            ? "bg-gray-700 text-white"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
        {Math.abs(trend)}%
      </div>
    ) : null;

  return (
    <div className="relative bg-white rounded-2xl p-5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold truncate">
            {title}
          </p>
          <p className="text-4xl font-bold text-gray-900 mt-2.5 tracking-tight leading-none">
            {isNumeric && animate ? <AnimatedNumber target={value} /> : isNumeric ? value.toLocaleString() : value}
          </p>
          {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
          {trendEl && <div className="mt-3">{trendEl}</div>}
        </div>
        {icon && (
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gray-900 text-white shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
