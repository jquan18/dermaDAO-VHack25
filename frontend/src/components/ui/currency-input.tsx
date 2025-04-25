import { Input, InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { myrToEth, formatEth } from "@/lib/currency";

interface CurrencyInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  label?: string;
  description?: string;
  onChange: (ethValue: number, myrValue: number) => void;
  initialEthValue?: number;
  showEthEquivalent?: boolean;
  className?: string;
}

export function CurrencyInput({
  label,
  description,
  onChange,
  initialEthValue = 0,
  showEthEquivalent = true,
  className = "",
  ...props
}: CurrencyInputProps) {
  // Calculate initial MYR value from ETH
  const initialMyrValue = initialEthValue ? (initialEthValue * 1_000_000).toFixed(0) : "";
  
  const [myrValue, setMyrValue] = useState<string>(initialMyrValue.toString());
  
  useEffect(() => {
    // Update when initialEthValue changes externally
    if (initialEthValue) {
      const newMyrValue = (initialEthValue * 1_000_000).toFixed(0);
      if (newMyrValue !== myrValue) {
        setMyrValue(newMyrValue);
      }
    }
  }, [initialEthValue]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMyrValue = e.target.value;
    setMyrValue(newMyrValue);
    
    // Convert to ETH for backend use
    const numericValue = parseFloat(newMyrValue) || 0;
    const ethValue = myrToEth(numericValue);
    
    // Pass both values to parent component
    onChange(ethValue, numericValue);
  };
  
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label htmlFor={`currency-input-${label}`}>{label}</Label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">RM</span>
        <Input
          id={`currency-input-${label}`}
          type="number"
          className="pl-7"
          value={myrValue}
          onChange={handleChange}
          {...props}
        />
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {showEthEquivalent && parseFloat(myrValue) > 0 && (
        <p className="text-xs text-muted-foreground">
          Equivalent to {formatEth(myrToEth(parseFloat(myrValue)))} on blockchain
        </p>
      )}
    </div>
  );
} 