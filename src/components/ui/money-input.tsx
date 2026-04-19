import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onChange: (value: number) => void;
  allowNegative?: boolean;
}

/**
 * 통화 입력 컴포넌트
 * - 숫자만 입력 가능 (정규식 검증)
 * - 천 단위 콤마 자동 표시
 * - 다크 모드 톤 (bg-input/60)
 * - 우측 ₩ 표시
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, allowNegative = false, placeholder, ...props }, ref) => {
    const format = (n: number | null | undefined) => {
      if (n == null || Number.isNaN(n)) return "";
      return n.toLocaleString("ko-KR");
    };

    const [display, setDisplay] = React.useState<string>(format(value));

    // 외부 value 변화 시 표시 동기화 (편집 중 외 케이스)
    React.useEffect(() => {
      setDisplay(format(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // 숫자/마이너스/콤마/공백만 허용 → 그 외 제거
      const filtered = raw.replace(allowNegative ? /[^\d-]/g : /[^\d]/g, "");
      if (filtered === "" || filtered === "-") {
        setDisplay(filtered);
        onChange(0);
        return;
      }
      const n = Number(filtered);
      if (!Number.isFinite(n)) return;
      setDisplay(n.toLocaleString("ko-KR"));
      onChange(n);
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder ?? "0"}
          className={cn("h-11 bg-input/60 tabular-nums pr-9 text-right font-medium", className)}
          {...props}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          ₩
        </span>
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
