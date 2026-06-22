import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

test("renders Graphic Novel Price Tracker title", () => {
  render(<App />);

  expect(
    screen.getByText("Graphic Novel Price Tracker")
  ).toBeInTheDocument();
});