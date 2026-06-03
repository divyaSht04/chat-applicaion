import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "./MessageInput";

describe("MessageInput", () => {
  it("renders textarea and send button", () => {
    render(<MessageInput onSend={() => {}} />);
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
    expect(screen.getByTestId("send-button")).toBeInTheDocument();
  });

  it("calls onSend and clears input on submit", async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    await userEvent.type(screen.getByTestId("message-input"), "hello");
    await userEvent.click(screen.getByTestId("send-button"));

    expect(onSend).toHaveBeenCalledWith("hello");
    expect(screen.getByTestId("message-input")).toHaveValue("");
  });

  it("does not call onSend for blank input", async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    await userEvent.click(screen.getByTestId("send-button"));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends on Enter key without shift", async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    await userEvent.type(screen.getByTestId("message-input"), "hi{Enter}");

    expect(onSend).toHaveBeenCalledWith("hi");
  });

  it("does not send on Shift+Enter", async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    await userEvent.type(
      screen.getByTestId("message-input"),
      "line1{Shift>}{Enter}{/Shift}line2",
    );

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables when disabled prop is true", () => {
    render(<MessageInput onSend={() => {}} disabled={true} />);
    expect(screen.getByTestId("message-input")).toBeDisabled();
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });
});
