import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-opacity duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90 active:scale-[0.98]",
        variant === "secondary" && "border border-line-strong bg-elevated text-fg hover:border-accent/40",
        variant === "ghost" && "text-muted hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}
