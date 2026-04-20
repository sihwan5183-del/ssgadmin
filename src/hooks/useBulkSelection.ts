import { useCallback, useMemo, useState } from "react";

/**
 * 페이지 단위의 다중 선택 관리.
 * - ids: 현재 화면에 보이는 행의 id 목록
 * - 전체선택 = 현재 페이지(=ids) 기준
 */
export function useBulkSelection<T extends string = string>(currentIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  const allOnPageSelected = useMemo(
    () => currentIds.length > 0 && currentIds.every((id) => selected.has(id)),
    [currentIds, selected],
  );
  const someOnPageSelected = useMemo(
    () => currentIds.some((id) => selected.has(id)) && !allOnPageSelected,
    [currentIds, selected, allOnPageSelected],
  );

  const togglePage = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (checked) currentIds.forEach((id) => next.add(id));
        else currentIds.forEach((id) => next.delete(id));
        return next;
      });
    },
    [currentIds],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selectedIds,
    selectedCount: selected.size,
    isSelected,
    toggle,
    togglePage,
    allOnPageSelected,
    someOnPageSelected,
    clear,
  };
}
