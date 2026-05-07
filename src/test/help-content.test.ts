import { describe, expect, it } from "vitest";

import { getRouteHelp, searchHelpArticles } from "@/lib/help-content";

describe("help content", () => {
  it("maps detail routes to the correct contextual help", () => {
    expect(getRouteHelp("/inventory/123").id).toBe("inventory");
    expect(getRouteHelp("/pick-lists/abc").id).toBe("pick-lists");
  });

  it("finds wiki articles by operational keywords", () => {
    const results = searchHelpArticles("transfer");

    expect(results.some((article) => article.id === "transfer-flow")).toBe(true);
  });

  it("documents enterprise setup topics", () => {
    expect(searchHelpArticles("netsuite").some((article) => article.id === "netsuite-integration")).toBe(true);
    expect(searchHelpArticles("zpl").some((article) => article.id === "zebra-printing")).toBe(true);
    expect(searchHelpArticles("warehouse brain").some((article) => article.id === "warehouse-brain")).toBe(true);
  });

  it("documents badges, lean controls, templates, and references", () => {
    expect(searchHelpArticles("badge").some((article) => article.id === "user-management")).toBe(true);
    expect(searchHelpArticles("csv").some((article) => article.id === "product-mastery")).toBe(true);
    expect(searchHelpArticles("5s").some((article) => article.id === "lean-standard-work")).toBe(true);
    expect(searchHelpArticles("gs1").some((article) => article.references?.some((reference) => reference.url.includes("gs1.org")))).toBe(true);
  });
});
