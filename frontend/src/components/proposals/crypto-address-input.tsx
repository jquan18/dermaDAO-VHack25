"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Clipboard, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ethers } from "ethers";

interface CryptoAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CryptoAddressInput({
  value,
  onChange,
  error,
  disabled = false
}: CryptoAddressInputProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showClipboardSuccess, setShowClipboardSuccess] = useState(false);

  const validateAddress = (address: string) => {
    if (!address) {
      setIsValid(null);
      return;
    }
    
    try {
      const isValidAddress = ethers.isAddress(address);
      setIsValid(isValidAddress);
    } catch (err) {
      setIsValid(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const address = e.target.value;
    onChange(address);
    validateAddress(address);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
      validateAddress(text);
      setShowClipboardSuccess(true);
      setTimeout(() => setShowClipboardSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="crypto-address">Recipient Wallet Address</Label>
        {isValid === true && (
          <span className="text-sm text-green-600 flex items-center">
            <Check className="h-3 w-3 mr-1" /> Valid Address
          </span>
        )}
      </div>
      
      <div className="flex">
        <Input
          id="crypto-address"
          value={value}
          onChange={handleChange}
          placeholder="0x..."
          className={`flex-1 ${isValid === false ? 'border-red-500' : ''} ${
            isValid === true ? 'border-green-500' : ''
          }`}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="ml-2"
          onClick={handlePaste}
          disabled={disabled}
          title="Paste from clipboard"
        >
          {showClipboardSuccess ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Clipboard className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isValid === false && !error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invalid Ethereum address format</AlertDescription>
        </Alert>
      )}
      
      <p className="text-sm text-muted-foreground">
        Enter a valid Ethereum address for the recipient of this transfer
      </p>
    </div>
  );
} 