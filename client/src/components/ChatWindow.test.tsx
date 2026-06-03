import { render, screen, fireEvent } from "@testing-library/react";
import { ChatWindow } from "./ChatWindow";
import type { Message } from "../types";

const noop = () => {};

const defaultProps = {
  currentUserId: 1,
  conversationName: "Bob",
  conversationType: "direct" as const,
  myStatus: "accepted" as const,
  hasPendingMember: false,
  isOwner: false,
  hasMore: false,
  loadingMore: false,
  onSend: noop,
  onLogout: noop,
  onAccept: noop,
  onDecline: noop,
  onLeave: noop,
  onDelete: noop,
  onManageMembers: noop,
  onLoadMore: noop,
  onMessagesAreaRef: noop,
};

const messages: Message[] = [
  {
    id: 1,
    conversation_id: 10,
    sender_id: 1,
    content: "hello from me",
    created_at: "2024-01-01T00:00:00Z",
    username: "alice",
  },
  {
    id: 2,
    conversation_id: 10,
    sender_id: 2,
    content: "hey there",
    created_at: "2024-01-01T00:00:01Z",
    username: "bob",
  },
];

describe("ChatWindow", () => {
  it("renders the conversation name in header", () => {
    render(<ChatWindow {...defaultProps} messages={[]} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    render(<ChatWindow {...defaultProps} messages={[]} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it("renders message bubbles", () => {
    render(<ChatWindow {...defaultProps} messages={messages} />);
    expect(screen.getByText("hello from me")).toBeInTheDocument();
    expect(screen.getByText("hey there")).toBeInTheDocument();
  });

  it("applies mine/theirs class based on sender_id", () => {
    render(<ChatWindow {...defaultProps} messages={messages} />);
    const rows = screen.getAllByTestId("message-bubble");
    expect(rows[0]).toHaveClass("mine");
    expect(rows[1]).toHaveClass("theirs");
  });

  it("shows request banner when myStatus is pending", () => {
    render(<ChatWindow {...defaultProps} messages={[]} myStatus="pending" />);
    expect(screen.getByTestId("request-banner")).toBeInTheDocument();
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("calls onAccept when Accept button clicked", () => {
    let called = false;
    render(
      <ChatWindow
        {...defaultProps}
        messages={[]}
        myStatus="pending"
        onAccept={() => {
          called = true;
        }}
      />,
    );
    fireEvent.click(screen.getByText("Accept"));
    expect(called).toBe(true);
  });

  it("shows pending notice for initiator when recipient has not accepted", () => {
    render(
      <ChatWindow {...defaultProps} messages={[]} hasPendingMember={true} />,
    );
    expect(screen.getByTestId("pending-notice")).toBeInTheDocument();
  });

  it("shows Leave button for non-owners", () => {
    render(<ChatWindow {...defaultProps} messages={[]} />);
    expect(screen.getByText("Leave")).toBeInTheDocument();
  });

  it("shows Delete button for group owners", () => {
    render(
      <ChatWindow
        {...defaultProps}
        messages={[]}
        conversationType="group"
        isOwner={true}
      />,
    );
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("disables message input when pending", () => {
    render(<ChatWindow {...defaultProps} messages={[]} myStatus="pending" />);
    expect(screen.getByTestId("message-input")).toBeDisabled();
  });

  it("shows load-more button when hasMore is true", () => {
    render(<ChatWindow {...defaultProps} messages={[]} hasMore={true} />);
    expect(screen.getByTestId("load-more-btn")).toBeInTheDocument();
  });

  it("shows loading spinner instead of button while loadingMore", () => {
    render(
      <ChatWindow
        {...defaultProps}
        messages={[]}
        hasMore={true}
        loadingMore={true}
      />,
    );
    expect(screen.queryByTestId("load-more-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("load-more-spinner")).toBeInTheDocument();
  });

  it("renders system messages centered without a bubble", () => {
    const sysMsg: Message = {
      id: 99,
      conversation_id: 10,
      sender_id: 2,
      content: "bob left the group",
      content_type: "system",
      created_at: "2024-01-01T00:00:00Z",
      username: "bob",
    };
    render(
      <ChatWindow
        {...defaultProps}
        messages={[sysMsg]}
        conversationType="group"
      />,
    );
    expect(screen.getByTestId("system-message")).toHaveTextContent(
      "bob left the group",
    );
    expect(screen.queryByTestId("message-bubble")).not.toBeInTheDocument();
  });

  it("shows sender name for received group messages", () => {
    render(
      <ChatWindow
        {...defaultProps}
        messages={messages}
        conversationType="group"
      />,
    );
    const senders = document.querySelectorAll(".bubble-sender");
    expect(senders).toHaveLength(1);
    expect(senders[0]).toHaveTextContent("bob");
  });
});
