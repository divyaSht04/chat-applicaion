import { test, expect } from "@playwright/test";

const API = "http://localhost:3000";

test("login redirects to /chat", async ({ page }) => {
  await page.route(`${API}/auth/login`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fake-token",
        user: {
          id: 1,
          username: "alice",
          email: "alice@example.com",
          role: "user",
          display_name: null,
          avatar_url: null,
        },
      }),
    }),
  );

  await page.goto("/login");
  await page.fill('[data-testid="email"]', "alice@example.com");
  await page.fill('[data-testid="password"]', "password123");
  await page.click('[data-testid="submit"]');

  await expect(page).toHaveURL("/chat");
});

test("shows error on failed login", async ({ page }) => {
  await page.route(`${API}/auth/login`, (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );

  await page.goto("/login");
  await page.fill('[data-testid="email"]', "bad@example.com");
  await page.fill('[data-testid="password"]', "wrong");
  await page.click('[data-testid="submit"]');

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("register redirects to /chat", async ({ page }) => {
  await page.route(`${API}/auth/register`, (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fake-token",
        user: {
          id: 2,
          username: "bob",
          email: "bob@example.com",
          role: "user",
          display_name: null,
          avatar_url: null,
        },
      }),
    }),
  );

  await page.goto("/register");
  await page.fill('[data-testid="username"]', "bob");
  await page.fill('[data-testid="email"]', "bob@example.com");
  await page.fill('[data-testid="password"]', "password123");
  await page.click('[data-testid="submit"]');

  await expect(page).toHaveURL("/chat");
});

test("root redirects to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});
