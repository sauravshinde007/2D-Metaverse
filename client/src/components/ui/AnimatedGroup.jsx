// src/components/ui/AnimatedGroup.jsx
import React from 'react'
import { motion } from 'framer-motion'

export default function AnimatedGroup({ children, className = '', variants = {}, style }) {
  const container = variants.container || { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }
  return (
    <motion.div initial="hidden" animate="visible" variants={container} className={className} style={style}>
      {children}
    </motion.div>
  )
}
