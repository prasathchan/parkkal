// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No patients found" />);
    expect(screen.getByText("No patients found")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Add your first record to get started." />);
    expect(screen.getByText("Add your first record to get started.")).toBeTruthy();
  });

  it("does not render description when absent", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText(/get started/i)).toBeNull();
  });

  it("renders action button with onClick handler", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No visits"
        action={{ label: "Add Visit", onClick }}
      />
    );
    const btn = screen.getByRole("button", { name: "Add Visit" });
    expect(btn).toBeTruthy();
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders action as anchor link when href is provided", () => {
    render(
      <EmptyState
        title="No records"
        action={{ label: "Create", href: "/new" }}
      />
    );
    const link = screen.getByRole("link", { name: "Create" });
    expect((link as HTMLAnchorElement).href).toContain("/new");
  });

  it("does not render action when action prop is absent", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders custom icon when provided", () => {
    render(
      <EmptyState title="X" icon={<span data-testid="custom-icon">icon</span>} />
    );
    expect(screen.getByTestId("custom-icon")).toBeTruthy();
  });
});
