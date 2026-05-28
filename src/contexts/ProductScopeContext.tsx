import { createContext, useContext, useState, ReactNode } from "react";

export type ProductScope =
  | "all"
  | "모바일"
  | "인터넷"
  | "TV프리"
  | "스마트홈"
  | "대명"
  | "업셀";

interface Ctx {
  scope: ProductScope;
  setScope: (s: ProductScope) => void;
}

const ProductScopeContext = createContext<Ctx>({
  scope: "all",
  setScope: () => {},
});

export const ProductScopeProvider = ({ children }: { children: ReactNode }) => {
  const [scope, setScope] = useState<ProductScope>("all");
  return (
    <ProductScopeContext.Provider value={{ scope, setScope }}>
      {children}
    </ProductScopeContext.Provider>
  );
};

export const useProductScope = () => useContext(ProductScopeContext);

/** 단일 sales row가 현재 선택된 6대 상품 스코프에 속하는지 판정 */
export const matchProductScope = (
  product: string | null | undefined,
  scope: ProductScope,
  opts?: { saleType?: string | null; bundle?: string | null },
): boolean => {
  if (scope === "all") return true;
  const p = (product ?? "").trim();
  const pl = p.toLowerCase();
  const st = (opts?.saleType ?? "").trim();
  switch (scope) {
    case "모바일":
      return (
        p.includes("모바일") ||
        p === "USIM MNP" ||
        p.includes("USIM") ||
        st === "USIM MNP" ||
        p === "세컨" ||
        p === "2nd" ||
        p.includes("세컨")
      );
    case "인터넷":
      return p.includes("인터넷") || p === "홈" || pl.includes("internet");
    case "TV프리":
      return p.includes("TV프리") || p.includes("TV");
    case "스마트홈":
      return p.includes("스마트홈") || pl.includes("iot") || p.includes("홈안심");
    case "대명":
      return p.includes("대명");
    case "업셀":
      return p.includes("맞춤") || p.includes("업셀");
    default:
      return true;
  }
};

/** 스코어보드 카드의 6대 항목 정의 (라벨 + 매칭 키) */
export const PRODUCT_SCOPE_ITEMS: { key: Exclude<ProductScope, "all">; label: string }[] = [
  { key: "모바일", label: "모바일" },
  { key: "인터넷", label: "인터넷" },
  { key: "TV프리", label: "TV프리" },
  { key: "스마트홈", label: "스마트홈" },
  { key: "대명", label: "대명" },
  { key: "업셀", label: "업셀" },
];