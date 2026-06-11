import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const errorId = id ? `${id}-error` : undefined;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          aria-describedby={error && errorId ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full px-4 py-2.5 border rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition",
            error ? "border-red-400 focus:ring-red-400" : "border-slate-300",
            className
          )}
          {...props}
        />
        {error && <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
