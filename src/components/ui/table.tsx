import { cn } from "@/lib/utils";
import { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";

function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full text-sm text-left", className)}
        {...props}
      />
    </div>
  );
}

function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-slate-50 border-b border-slate-200", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-slate-100", className)} {...props} />;
}

function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("hover:bg-slate-50 transition-colors", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 text-slate-700", className)}
      {...props}
    />
  );
}

function TableHeadCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider",
        className
      )}
      {...props}
    />
  );
}

export { Table, TableHead, TableBody, TableRow, TableCell, TableHeadCell };
