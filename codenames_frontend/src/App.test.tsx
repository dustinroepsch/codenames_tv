import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

// Mock child pages to isolate routing tests
vi.mock("./pages/Home", () => ({
  default: () => <div data-testid="home-page">Home</div>,
}));
vi.mock("./pages/Host", () => ({
  default: () => <div data-testid="host-page">Host</div>,
}));
vi.mock("./pages/Play", () => ({
  default: () => <div data-testid="play-page">Play</div>,
}));

describe("App routing", () => {
  it("renders Home on /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });

  it("renders Host on /host/:code", () => {
    render(
      <MemoryRouter initialEntries={["/host/ABCD"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("host-page")).toBeInTheDocument();
  });

  it("renders Play on /play/:code", () => {
    render(
      <MemoryRouter initialEntries={["/play/ABCD"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("play-page")).toBeInTheDocument();
  });
});
