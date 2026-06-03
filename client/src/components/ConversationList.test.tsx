import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ConversationList } from "./ConversationList";
import * as api from "../api/conversations";

vi.mock("../api/conversations");

const mockConversations = [
  {
    id: 1,
    type: "direct" as const,
    name: null,
    display_name: "bob",
    created_by: 1,
    updated_at: "",
  },
];

const mockUsers = [
  {
    id: 2,
    username: "bob",
    email: "bob@test.com",
    avatar_url: null,
    role: "user",
    display_name: null,
  },
];

describe("ConversationList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders sidebar title", () => {
    render(
      <ConversationList
        conversations={[]}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={() => {}}
        onCreated={() => {}}
        unread={new Set()}
      />,
    );
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", () => {
    render(
      <ConversationList
        conversations={[]}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={() => {}}
        onCreated={() => {}}
        unread={new Set()}
      />,
    );
    expect(screen.getByText(/search above/i)).toBeInTheDocument();
  });

  it("renders existing conversations with display_name", () => {
    render(
      <ConversationList
        conversations={mockConversations}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={() => {}}
        onCreated={() => {}}
        unread={new Set()}
      />,
    );
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("shows unread dot for conversations with unread messages", () => {
    render(
      <ConversationList
        conversations={mockConversations}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={() => {}}
        onCreated={() => {}}
        unread={new Set([1])}
      />,
    );
    expect(screen.getByTestId("unread-dot")).toBeInTheDocument();
  });

  it("calls onSelect when a conversation is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <ConversationList
        conversations={mockConversations}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={onSelect}
        onCreated={() => {}}
        unread={new Set()}
      />,
    );
    await userEvent.click(screen.getByText("bob"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("searches as user types 2+ characters", async () => {
    vi.mocked(api.searchUsers).mockResolvedValue(mockUsers);
    render(
      <ConversationList
        conversations={[]}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={() => {}}
        onCreated={() => {}}
        unread={new Set()}
      />,
    );

    await userEvent.type(screen.getByTestId("search-input"), "bo");

    // waitFor polls until the debounce fires and the mock resolves
    await waitFor(
      () => expect(api.searchUsers).toHaveBeenCalledWith("tok", "bo"),
      {
        timeout: 2000,
      },
    );
    await waitFor(() =>
      expect(screen.getByTestId("search-results")).toBeInTheDocument(),
    );
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("starts a direct chat when a search result is clicked", async () => {
    vi.mocked(api.searchUsers).mockResolvedValue(mockUsers);
    vi.mocked(api.createDirect).mockResolvedValue({
      id: 10,
      type: "direct",
      name: null,
      created_by: 1,
      updated_at: "",
    });
    const onSelect = vi.fn();
    const onCreated = vi.fn();

    render(
      <ConversationList
        conversations={[]}
        selectedId={null}
        currentUserId={1}
        token="tok"
        onSelect={onSelect}
        onCreated={onCreated}
        unread={new Set()}
      />,
    );

    await userEvent.type(screen.getByTestId("search-input"), "bo");
    await waitFor(() => expect(screen.getByText("bob")).toBeInTheDocument(), {
      timeout: 2000,
    });
    await userEvent.click(screen.getByText("bob"));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(10));
  });
});
