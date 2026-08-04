import { useCallback, useEffect, useState } from "react";
import { parseEther } from "viem";
import { CommonInputProps, InputBase, IntegerVariant, isValidInteger } from "~~/components/scaffold-eth";
import { InputGroupButton } from "~~/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "~~/components/ui/tooltip";

type IntegerInputProps = CommonInputProps<string> & {
  variant?: IntegerVariant;
  disableMultiplyBy1e18?: boolean;
};

export const IntegerInput = ({
  value,
  onChange,
  name,
  placeholder,
  disabled,
  variant = IntegerVariant.UINT256,
  disableMultiplyBy1e18 = false,
}: IntegerInputProps) => {
  const [inputError, setInputError] = useState(false);
  const multiplyBy1e18 = useCallback(() => {
    if (!value) {
      return;
    }
    return onChange(parseEther(value).toString());
  }, [onChange, value]);

  useEffect(() => {
    if (isValidInteger(variant, value)) {
      setInputError(false);
    } else {
      setInputError(true);
    }
  }, [value, variant]);

  return (
    <InputBase
      name={name}
      value={value}
      placeholder={placeholder}
      error={inputError}
      onChange={onChange}
      disabled={disabled}
      suffix={
        !inputError &&
        !disableMultiplyBy1e18 && (
          <Tooltip>
            <TooltipTrigger
              render={<InputGroupButton onClick={multiplyBy1e18} disabled={disabled} aria-label="Multiply by 1e18" />}
            >
              ∗
            </TooltipTrigger>
            <TooltipContent>Multiply by 1e18 (wei)</TooltipContent>
          </Tooltip>
        )
      }
    />
  );
};
