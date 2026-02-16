import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers";

describe("Categories API", () => {
  it("returns categories and tags", async () => {
    const { status, data } = await apiRequest("GET", "/api/v1/categories");
    expect(status).toBe(200);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.tags.length).toBeGreaterThan(0);
  });
});
