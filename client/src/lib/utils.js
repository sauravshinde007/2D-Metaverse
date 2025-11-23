// src/lib/utils.js
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
