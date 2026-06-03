import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("renders fields and submit button", () => {
    render(<LoginForm onSubmit={async () => {}} error={null} />);
    expect(screen.getByTestId("email")).toBeInTheDocument();
    expect(screen.getByTestId("password")).toBeInTheDocument();
    expect(screen.getByTestId("submit")).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    render(
      <LoginForm
        onSubmit={async () => {}}
        error="Invalid email or password."
      />,
    );
    expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("calls onSubmit with entered values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} error={null} />);

    await userEvent.type(screen.getByTestId("email"), "alice@example.com");
    await userEvent.type(screen.getByTestId("password"), "secret123");
    await userEvent.click(screen.getByTestId("submit"));

    expect(onSubmit).toHaveBeenCalledWith("alice@example.com", "secret123");
  });

  it("disables submit while loading", async () => {
    let resolve!: () => void;
    const onSubmit = vi
      .fn()
      .mockReturnValue(new Promise<void>((r) => (resolve = r)));
    render(<LoginForm onSubmit={onSubmit} error={null} />);

    await userEvent.type(screen.getByTestId("email"), "a@b.com");
    await userEvent.type(screen.getByTestId("password"), "pass");
    await userEvent.click(screen.getByTestId("submit"));

    expect(screen.getByTestId("submit")).toBeDisabled();
    resolve();
  });
});
