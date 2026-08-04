import { CommonInputProps, InputBase, SIGNED_NUMBER_REGEX } from "~~/components/scaffold-eth";
import { InputGroupText } from "~~/components/ui/input-group";

/**
 * Input for ETH amount.
 *
 * onChange will always be called with the value in ETH
 */
export const EtherInput = ({ value, name, placeholder, onChange, disabled }: CommonInputProps) => {
  const handleChangeNumber = (newValue: string) => {
    if (newValue && !SIGNED_NUMBER_REGEX.test(newValue)) {
      return;
    }

    onChange(newValue);
  };

  return (
    <InputBase
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={handleChangeNumber}
      disabled={disabled}
      prefix={<InputGroupText>Ξ</InputGroupText>}
    />
  );
};
