import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("winclaw", 16)).toBe("winclaw");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("winclaw-status-output", 10)).toBe("winclaw-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
