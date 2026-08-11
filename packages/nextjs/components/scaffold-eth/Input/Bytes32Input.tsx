import { useCallback } from "react";
import { hexToString, isHex, stringToHex } from "viem";
import { CommonInputProps, InputBase } from "~~/components/scaffold-eth";
import { InputGroupButton } from "~~/components/ui/input-group";

export const Bytes32Input = ({
  value,
  onChange,
  name,
  placeholder,
  disabled,
}: CommonInputProps) => {
  const convertStringToBytes32 = useCallback(() => {
    if (!value) {
      return;
    }
    onChange(
      isHex(value)
        ? hexToString(value, { size: 32 })
        : stringToHex(value, { size: 32 }),
    );
  }, [onChange, value]);

  return (
    <InputBase
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      disabled={disabled}
      suffix={
        <InputGroupButton
          onClick={convertStringToBytes32}
          aria-label="Cambiar representación de bytes32"
        >
          #
        </InputGroupButton>
      }
    />
  );
};
