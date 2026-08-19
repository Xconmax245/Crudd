import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusColor(status: string): string {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-green-100 text-green-800';
    case 'DRAFT':
      return 'bg-amber-100 text-amber-800';
    case 'ARCHIVED':
      return 'bg-gray-200 text-gray-600';
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800';
    case 'FINISHED':
      return 'bg-gray-100 text-gray-700';
    case 'CANCELLED':
      return 'bg-red-100 text-red-700';
    case 'LOBBY':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
