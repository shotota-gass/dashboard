"use client";

interface RangeSelectorProps {
  value: number;
  onChange: (range: number) => void;
}

const RANGES = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

export default function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
            value === r.value
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
