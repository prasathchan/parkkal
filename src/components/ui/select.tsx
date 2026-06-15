import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-pk-body font-medium text-pk-text mb-pk-1">
            {label}
          </label>
        )}
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={cn("field-input appearance-none cursor-pointer", error && "field-error", className)}
          {...props}
        >
          {children}
        </select>
        {error && <p role="alert" className="mt-pk-1 text-pk-caption text-pk-danger-text">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
