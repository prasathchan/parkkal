// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("default variant has blue background classes", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-blue-600");
  });

  it("outline variant has border classes", () => {
    render(<Button variant="outline">Click</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border");
    expect(btn.className).toContain("bg-white");
  });

  it("destructive variant has red background", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("bg-red-600");
  });

  it("ghost variant has no solid background", () => {
    render(<Button variant="ghost">Cancel</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).not.toContain("bg-blue-600");
    expect(cls).not.toContain("bg-red-600");
  });

  it("sm size has small padding classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button").className).toContain("px-3");
  });

  it("lg size has large padding classes", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button").className).toContain("px-6");
  });

  it("forwards disabled prop and applies disabled styles", () => {
    render(<Button disabled>Submit</Button>);
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.className).toContain("disabled:opacity-50");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click me</Button>);
    screen.getByRole("button").click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("accepts and applies extra className", () => {
    render(<Button className="my-custom-class">X</Button>);
    expect(screen.getByRole("button").className).toContain("my-custom-class");
  });

  it("has displayName set", () => {
    expect(Button.displayName).toBe("Button");
  });
});
