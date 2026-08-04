import { ChangeEvent, FocusEvent, ReactNode, useCallback, useEffect, useRef } from "react";
import { CommonInputProps } from "~~/components/scaffold-eth";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~~/components/ui/input-group";

type InputBaseProps<T> = CommonInputProps<T> & {
  error?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  reFocus?: boolean;
};

export const InputBase = <T extends { toString: () => string } | undefined = string>({
  name,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  prefix,
  suffix,
  reFocus,
}: InputBaseProps<T>) => {
  const inputReft = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value as unknown as T);
    },
    [onChange],
  );

  // Runs only when reFocus prop is passed, useful for setting the cursor
  // at the end of the input. Example AddressInput
  const onFocus = (e: FocusEvent<HTMLInputElement, Element>) => {
    if (reFocus !== undefined) {
      e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length);
    }
  };
  useEffect(() => {
    if (reFocus !== undefined && reFocus === true) inputReft.current?.focus();
  }, [reFocus]);

  return (
    <InputGroup data-disabled={disabled || undefined}>
      {prefix ? <InputGroupAddon align="inline-start">{prefix}</InputGroupAddon> : null}
      <InputGroupInput
        placeholder={placeholder}
        name={name}
        value={value?.toString()}
        onChange={handleChange}
        disabled={disabled}
        autoComplete="off"
        ref={inputReft}
        onFocus={onFocus}
        aria-invalid={error || undefined}
        data-testid="function-input"
      />
      {suffix ? <InputGroupAddon align="inline-end">{suffix}</InputGroupAddon> : null}
    </InputGroup>
  );
};
