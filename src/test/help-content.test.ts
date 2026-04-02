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
});
