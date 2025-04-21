"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Landmark, Coins } from "lucide-react";

interface TransferTypeSelectorProps {
  value: "bank" | "crypto";
  onChange: (value: "bank" | "crypto") => void;
  disabled?: boolean;
}

export function TransferTypeSelector({ 
  value, 
  onChange, 
  disabled = false 
}: TransferTypeSelectorProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(val) => onChange(val as "bank" | "crypto")}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      disabled={disabled}
    >
      <div>
        <RadioGroupItem
          value="bank"
          id="bank"
          className="peer sr-only"
          disabled={disabled}
        />
        <Label
          htmlFor="bank"
          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Landmark className="mb-3 h-6 w-6" />
          <div className="text-center">
            <p className="font-medium">Bank Transfer</p>
            <p className="text-sm text-muted-foreground">
              Transfer funds to a verified bank account
            </p>
          </div>
        </Label>
      </div>

      <div>
        <RadioGroupItem
          value="crypto"
          id="crypto"
          className="peer sr-only"
          disabled={disabled}
        />
        <Label
          htmlFor="crypto"
          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Coins className="mb-3 h-6 w-6" />
          <div className="text-center">
            <p className="font-medium">Crypto Transfer</p>
            <p className="text-sm text-muted-foreground">
              Transfer directly to another wallet address
            </p>
          </div>
        </Label>
      </div>
    </RadioGroup>
  );
} 