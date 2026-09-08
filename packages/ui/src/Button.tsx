import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "lime" | "blue";

export function Button({
  variant = "primary",
  size,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "lg";
  children: ReactNode;
}) {
  return (
    <button
      className={`fused-btn fused-btn-${variant}${size === "lg" ? " fused-btn-lg" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
