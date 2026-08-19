import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely — resolves conflicts, applies clsx conditionals */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
