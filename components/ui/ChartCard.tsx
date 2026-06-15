import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  badge,
  children,
  className = "",
  action,
}: ChartCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden ${className}`}>
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
            {badge && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500 tracking-wide">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0 ml-4">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
