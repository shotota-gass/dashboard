interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const variants = {
  default: "bg-gray-100 text-gray-600 border border-gray-200",
  success: "bg-gray-900 text-white",
  warning: "bg-gray-600 text-white",
  danger:  "bg-black text-white",
  info:    "bg-gray-100 text-gray-700 border border-gray-200",
};

export default function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
