// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorState } from "@/components/ui/error-state";

describe("ErrorState", () => {
  it("renders default error message when none is provided", () => {
    render(<ErrorState />);
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it("renders custom message when provided", () => {
    render(<ErrorState message="Failed to load patients." />);
    expect(screen.getByText("Failed to load patients.")).toBeTruthy();
  });

  it("renders 'Failed to load' heading", () => {
    render(<ErrorState />);
    expect(screen.getByText("Failed to load")).toBeTruthy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("does not render retry button when onRetry is absent", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onRetry when Try again is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    screen.getByRole("button", { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
