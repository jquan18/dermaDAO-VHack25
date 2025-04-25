// Conversion rates
export const ETH_TO_MYR = 1_000_000; // Exaggerated rate: 1 ETH = MYR 1,000,000 (for presentation)
export const MYR_TO_ETH = 1 / ETH_TO_MYR; // MYR 1 = 0.000001 ETH

/**
 * Convert ETH to MYR display value (exaggerated for presentation)
 */
export function ethToMyr(ethAmount: number | string): number {
  const amount = typeof ethAmount === 'string' ? parseFloat(ethAmount) : ethAmount;
  return amount * ETH_TO_MYR;
}

/**
 * Convert MYR input to ETH for blockchain operations
 */
export function myrToEth(myrAmount: number | string): number {
  const amount = typeof myrAmount === 'string' ? parseFloat(myrAmount) : myrAmount;
  return amount * MYR_TO_ETH;
}

/**
 * Format MYR amount for display
 */
export function formatMyr(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numAmount);
}

/**
 * Format ETH amount for display (when needed)
 */
export function formatEth(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${numAmount.toFixed(6)} ETH`;
}

/**
 * Format currency amount based on context
 */
export function formatCurrency(amount: number | string, showEth: boolean = false): string {
  if (showEth) {
    return formatEth(amount);
  }
  // Convert ETH to MYR and format
  const ethAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return formatMyr(ethToMyr(ethAmount));
} 