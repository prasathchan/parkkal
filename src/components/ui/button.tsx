import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `default` = teal primary · `accent` = the scarce gold CTA · see Brand §2.2 */
  variant?: "default" | "accent" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-pk-2 font-medium rounded-pk-sm transition-colors duration-pk-fast ease-pk-out",
          "focus-visible:outline-none focus-visible:shadow-pk-focus disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-pk-primary text-white hover:bg-pk-teal-500 active:bg-pk-teal-700":
              variant === "default",
            "bg-pk-accent-action text-white hover:bg-[var(--pk-accent-hover)] active:bg-[var(--pk-accent-hover)]":
              variant === "accent",
            "border border-pk-border bg-transparent text-pk-text hover:bg-pk-surface-raised hover:border-pk-border-strong":
              variant === "outline",
            "bg-transparent text-pk-text-secondary hover:bg-pk-surface-raised hover:text-pk-text":
              variant === "ghost",
            "bg-pk-danger text-white hover:bg-pk-danger-text":
              variant === "destructive",
          },
          {
            "px-pk-3 py-pk-1 text-pk-body-sm min-h-[32px]": size === "sm",
            "px-pk-4 py-pk-2 text-pk-body min-h-[40px]": size === "md",
            "px-pk-6 py-pk-3 text-pk-body-lg min-h-[48px]": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
