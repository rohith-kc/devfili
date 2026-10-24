import { describe, expect, it } from "vitest";
import { findLibraryMatch, type AppsEntry } from "../../src/lib/research/resolve";

const apps: AppsEntry[] = [
  { slug: "zoom", name: "Zoom", websiteUrl: "https://zoom.us", aliases: ["zoom", "zoom.us"], order: 1 },
  { slug: "microsoft-teams", name: "Microsoft Teams", websiteUrl: "https://microsoft.com", aliases: ["microsoft teams", "teams", "ms teams"], order: 2 },
];

describe("findLibraryMatch", () => {
  it("matches by slug", () => {
    expect(findLibraryMatch("zoom", apps)).toBe("zoom");
  });

  it("matches case-insensitively and trims whitespace", () => {
    expect(findLibraryMatch("  Zoom  ", apps)).toBe("zoom");
  });

  it("matches by alias", () => {
    expect(findLibraryMatch("teams", apps)).toBe("microsoft-teams");
    expect(findLibraryMatch("MS Teams", apps)).toBe("microsoft-teams");
  });

  it("matches a bare domain alias", () => {
    expect(findLibraryMatch("zoom.us", apps)).toBe("zoom");
  });

  it("returns null for an app not in the library", () => {
    expect(findLibraryMatch("calendly", apps)).toBeNull();
  });
});
