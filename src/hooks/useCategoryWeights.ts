import { useAppSettings } from "./useAppSettings";
import { DEFAULT_CATEGORY_META, SalesCategory } from "@/lib/salesCategory";

export interface CategoryWeights {
  mobile: number;
  home: number;
  upsell: number;
}

/**
 * app_settings.key='category.weights' → { mobile, home, upsell }
 * 미설정 시 기본값(1.0/2.0/0.5) 사용
 */
export function useCategoryWeights() {
  const { settings, upsert } = useAppSettings();
  const stored = (settings["category.weights"] ?? {}) as Partial<CategoryWeights>;
  const weights: CategoryWeights = {
    mobile: Number(stored.mobile ?? DEFAULT_CATEGORY_META.mobile.weight),
    home: Number(stored.home ?? DEFAULT_CATEGORY_META.home.weight),
    upsell: Number(stored.upsell ?? DEFAULT_CATEGORY_META.upsell.weight),
  };
  const weightOf = (cat: SalesCategory) => weights[cat];
  const save = (next: CategoryWeights) => upsert("category.weights", next);
  return { weights, weightOf, save };
}
