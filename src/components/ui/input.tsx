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
          <label htmlFor={id} className="block text-pk-body font-medium text-pk-text mb-pk-1">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          aria-describedby={error && errorId ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={cn("field-input", error && "field-error", className)}
          {...props}
        />
        {error && <p id={errorId} role="alert" className="mt-pk-1 text-pk-caption text-pk-danger-text">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
