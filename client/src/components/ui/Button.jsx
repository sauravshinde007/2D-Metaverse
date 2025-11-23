// src/components/ui/Button.jsx
import React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

export function Button({ children, variant = 'primary', className = '', as = 'button', to = '#', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-4 focus:ring-zinc-700/40'
  const styles = {
    primary: 'bg-white text-black px-4 py-2 shadow-sm',
    ghost: 'bg-transparent text-white/90 border border-zinc-700 px-4 py-2',
    outline: 'bg-transparent border border-zinc-700 text-white px-4 py-2',
  }
  const cls = cn(base, styles[variant] || styles.primary, className)

  if (as === 'link') {
    return (
      <Link to={to} className={cls} {...props}>
        {children || (variant === 'primary' ? 'Sign up' : 'Action')}
      </Link>
    )
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
