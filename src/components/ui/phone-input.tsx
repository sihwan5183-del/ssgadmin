import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/phoneFormat";

export type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string | null | undefined;
  onChange: (formatted: string) => void;
};

/**
 * 한국 전화번호 자동 포맷 입력. 숫자만 허용하고 길이에 맞춰 하이픈을 자동 삽입한다.
 * Backspace로 하이픈을 지워도 숫자가 남아있는 한 자연스럽게 재포맷된다.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = "010-0000-0000", ...rest }, ref) => {
    const display = formatPhone(value ?? "");
    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={13}
        placeholder={placeholder}
        value={display}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        {...rest}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";
