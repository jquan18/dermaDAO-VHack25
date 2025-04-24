import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"
import { ethToMyr, formatMyr } from "@/lib/currency"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate the progress percentage of a fundraising campaign
 */
export function calculateProgress(raised: number, goal: number): number {
  if (goal <= 0) return 0
  const progress = (raised / goal) * 100
  return Number(Math.min(progress, 100).toFixed(2)) // Cap at 100% and format to 2 decimal places
}

/**
 * Format currency values with appropriate symbol and decimals
 */
export function formatCurrency(amount: number, currency: string = "MYR", maximumFractionDigits: number = 2): string {
  // Use exaggerated conversion for ETH to MYR
  if (currency === "ETH") {
    // Use our exaggerated conversion rate and formatting
    return formatMyr(ethToMyr(amount));
  }

  // For other currencies, use standard formatting
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount)
}

/**
 * Calculate days left until a deadline
 */
export function calculateDaysLeft(endDate: Date | string): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate
  const now = new Date()
  
  // Clear time portion for accurate day calculation
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  const diffTime = endDateOnly.getTime() - nowDateOnly.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays) // Ensure non-negative
}

/**
 * Truncate Ethereum address for display
 */
export function truncateAddress(address: string, prefixLength: number = 6, suffixLength: number = 4): string {
  if (!address) return ""
  if (address.length <= prefixLength + suffixLength) return address
  
  const prefix = address.substring(0, prefixLength)
  const suffix = address.substring(address.length - suffixLength)
  
  return `${prefix}...${suffix}`
}

/**
 * Format date into human-readable string
 */
export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
}): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return "Invalid date"
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj)
}

/**
 * Format datetime to readable format
 * @param dateString ISO date string
 * @param options Custom date time format options
 * @returns Formatted date/time string
 */
export function formatDateTime(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return new Intl.DateTimeFormat('en-US', options || defaultOptions).format(date);
}

/**
 * Format an ETH value with appropriate decimal places
 * @param value The ETH value as a string or number
 * @param decimals Number of decimal places to show (default 4)
 * @returns Formatted ETH value
 */
export function formatEther(value: string | number, decimals = 4): string {
  if (!value) return '0.0000';
  
  // Convert the value to a number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Handle non-numeric values
  if (isNaN(numValue)) return '0.0000';
  
  // Format the value with the specified decimal places
  return numValue.toFixed(decimals);
}
