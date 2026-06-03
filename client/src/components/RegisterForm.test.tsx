import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./RegisterForm";

describe("RegisterForm", () => {
  it("renders all fields", () => {
    render(<RegisterForm onSubmit={async () => {}} error={null} />);
    expect(screen.getByTestId("username")).toBeInTheDocument();
    expect(screen.getByTestId("email")).toBeInTheDocument();
    expect(screen.getByTestId("password")).toBeInTheDocument();
    expect(screen.getByTestId("submit")).toBeInTheDocument();
  });

  it("shows error when error prop set", () => {
    render(<RegisterForm onSubmit={async () => {}} error="Email taken." />);
    expect(screen.getByText("Email taken.")).toBeInTheDocument();
  });

  it("calls onSubmit with all three values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegisterForm onSubmit={onSubmit} error={null} />);

    await userEvent.type(screen.getByTestId("username"), "alice");
    await userEvent.type(screen.getByTestId("email"), "alice@example.com");
    await userEvent.type(screen.getByTestId("password"), "secret123");
    await userEvent.click(screen.getByTestId("submit"));

    expect(onSubmit).toHaveBeenCalledWith(
      "alice",
      "alice@example.com",
      "secret123",
    );
  });
});
