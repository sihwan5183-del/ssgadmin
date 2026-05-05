import { describe, it, expect } from "vitest";
import { verifyLoadedSale, findMissingBoundKeys, isBlank } from "./saleFormLoader";

describe("saleFormLoader", () => {
  const original = {
    id: "abc",
    created_by: "user-1",
    channel: "온라인",
    manager: "user-2",
    customer_name: "홍길동",
    open_date: "2026-05-05",
  };

  it("isBlank treats null/undefined/empty string as blank", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank("")).toBe(true);
    expect(isBlank("  ")).toBe(true);
    expect(isBlank("x")).toBe(false);
    expect(isBlank(0)).toBe(false);
  });

  it("verifyLoadedSale flags missing identifiers", () => {
    expect(verifyLoadedSale(original).ok).toBe(true);
    expect(verifyLoadedSale(null).ok).toBe(false);
    expect(verifyLoadedSale({ id: "x" }).missing).toContain("created_by");
  });

  it("findMissingBoundKeys reports fields lost during binding", () => {
    const goodBound = { ...original };
    expect(findMissingBoundKeys(original, goodBound)).toEqual([]);

    const lostManager = { ...original, manager: null };
    expect(findMissingBoundKeys(original, lostManager)).toEqual(["manager"]);

    const empty = {};
    const all = findMissingBoundKeys(original, empty);
    expect(all).toEqual(
      expect.arrayContaining(["channel", "manager", "customer_name", "open_date"]),
    );
  });

  it("findMissingBoundKeys ignores fields that were blank in the original", () => {
    const orig = { id: "x", created_by: "u", channel: null };
    const bound = { id: "x", created_by: "u", channel: null };
    expect(findMissingBoundKeys(orig, bound)).toEqual([]);
  });
});