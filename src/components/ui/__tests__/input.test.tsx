// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders a text input by default", () => {
    render(<Input id="name" />);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("renders a label when label prop is provided", () => {
    render(<Input id="name" label="Full Name" />);
    expect(screen.getByLabelText("Full Name")).toBeTruthy();
  });

  it("associates label with input via htmlFor/id", () => {
    render(<Input id="email" label="Email" />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.id).toBe("email");
  });

  it("does not render a label element when label prop is absent", () => {
    render(<Input id="plain" />);
    expect(screen.queryByRole("label")).toBeNull();
  });

  it("shows error message and sets aria-invalid when error prop is provided", () => {
    render(<Input id="phone" error="Invalid phone number" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Invalid phone number");
  });

  it("error message has correct id linked via aria-describedby", () => {
    render(<Input id="phone" error="Required" />);
    const input = screen.getByRole("textbox");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBe("phone-error");
    expect(document.getElementById(errorId!)).toBeTruthy();
  });

  it("has the error class when error is present", () => {
    render(<Input id="x" error="Oops" />);
    expect(screen.getByRole("textbox").className).toContain("field-error");
  });

  it("uses the field-input token class when no error", () => {
    render(<Input id="x" />);
    const cls = screen.getByRole("textbox").className;
    expect(cls).toContain("field-input");
    expect(cls).not.toContain("field-error");
  });

  it("passes through standard input props", () => {
    render(<Input id="t" placeholder="Enter text" maxLength={50} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.placeholder).toBe("Enter text");
    expect(input.maxLength).toBe(50);
  });

  it("forwards onChange handler", () => {
    const onChange = vi.fn();
    render(<Input id="t" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("has displayName set", () => {
    expect(Input.displayName).toBe("Input");
  });
});
