import { describe, expect, it } from "vitest";
import { normalizeQuery, slugify } from "../../src/lib/normalize";

describe("normalizeQuery", () => {
  it("trims and lower-cases a plain name", () => {
    expect(normalizeQuery("  Zoom  ")).toBe("zoom");
  });

  it("takes the hostname without www from a full URL", () => {
    expect(normalizeQuery("https://www.zoom.us/pricing")).toBe("zoom.us");
  });

  it("takes the hostname without www from a bare domain with no protocol", () => {
    expect(normalizeQuery("www.notion.so")).toBe("notion.so");
  });

  it("leaves a single word that isn't a domain alone", () => {
    expect(normalizeQuery("Linear")).toBe("linear");
  });

  it("leaves a multi-word product description alone", () => {
    expect(normalizeQuery("Google Gmail")).toBe("google gmail");
  });

  it("returns an empty string unchanged", () => {
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("Microsoft Teams")).toBe("microsoft-teams");
  });

  it("strips leading/trailing non-alphanumeric runs", () => {
    expect(slugify("  Gong!  ")).toBe("gong");
  });

  it("collapses runs of non-alphanumeric characters into one hyphen", () => {
    expect(slugify("Google (Gmail)")).toBe("google-gmail");
  });
});
