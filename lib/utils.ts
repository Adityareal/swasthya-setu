import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names, resolving Tailwind conflicts last-wins.
 * Every component in `components/ui/` reads `cn` from here.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
