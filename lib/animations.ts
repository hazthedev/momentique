// ============================================
// Gatherly - Shared Animation Variants
// ============================================
// Reusable animation variants using Motion (Framer Motion)

import { Variants, Transition } from 'motion/react';

// ============================================
// SPRING CONFIGURATIONS
// ============================================

export const springConfigs = {
  // Bouncy - for exciting interactions
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 15,
  },
  // Smooth - for subtle animations
  smooth: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
  },
  // Gentle - for calm animations
  gentle: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
  },
  // Snappy - for quick feedback
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 30,
  },
  // Elastic - for bouncy entrance
  elastic: {
    type: 'spring' as const,
    stiffness: 350,
    damping: 12,
  },
};

// ============================================
// PHOTO CARD ANIMATIONS
// ============================================

export const photoCardVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.85,
    y: 20,
  },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...springConfigs.smooth,
      delay: i * 0.05, // Stagger effect
    },
  }),
  hover: {
    scale: 1.02,
    transition: springConfigs.gentle,
  },
  tap: {
    scale: 0.95,
    transition: springConfigs.snappy,
  },
};

// ============================================
// MODAL ANIMATIONS
// ============================================

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...springConfigs.elastic,
      delay: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
};

// ============================================
// LUCKY DRAW NUMBER ANIMATIONS
// ============================================

export const luckyNumberVariants: Variants = {
  hidden: {
    scale: 0,
    rotate: -180,
    opacity: 0,
  },
  visible: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: springConfigs.elastic,
  },
  pulse: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.3,
      times: [0, 0.5, 1],
    },
  },
};

// ============================================
// HEART REACTION ANIMATIONS
// ============================================

export const heartParticleVariants = (angle: number, distance: number = 60) => {
  const radian = (angle * Math.PI) / 180;
  return {
    initial: {
      scale: 0,
      x: 0,
      y: 0,
      opacity: 1,
      rotate: 0,
    },
    animate: {
      scale: 0,
      x: Math.cos(radian) * distance,
      y: Math.sin(radian) * distance,
      opacity: 0,
      rotate: angle,
    },
    transition: {
      duration: 0.8,
      ease: 'easeOut' as const,
    },
  };
};

export const heartBurstVariants: Variants = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: springConfigs.bouncy,
  },
};

// ============================================
// FLOATING BUTTON ANIMATIONS
// ============================================

export const floatingButtonVariants: Variants = {
  idle: {
    y: [0, -5, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  hover: {
    scale: 1.1,
    transition: springConfigs.gentle,
  },
  tap: {
    scale: 0.9,
    transition: springConfigs.snappy,
  },
};

// ============================================
// SUCCESS CHECKMARK ANIMATION
// ============================================

export const checkmarkVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.4, ease: 'easeInOut' },
      opacity: { duration: 0.2 },
    },
  },
};

// ============================================
// FILE CARD ANIMATIONS (UPLOAD MODAL)
// ============================================

export const fileCardVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    x: -20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: springConfigs.elastic,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    x: 20,
    transition: { duration: 0.2 },
  },
};

// ============================================
// BADGE/NUMBER COUNTER ANIMATION
// ============================================

export const counterVariants: Variants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: springConfigs.bouncy,
  },
  bump: {
    scale: [1, 1.3, 1],
    transition: {
      duration: 0.3,
      times: [0, 0.5, 1],
    },
  },
};

// ============================================
// GREETING MODAL ANIMATIONS
// ============================================

export const greetingModalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: -30,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...springConfigs.elastic,
      delay: 0.1,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get stagger delay for index-based animations
 */
export function getStaggerDelay(index: number, baseDelay: number = 0.05): number {
  return index * baseDelay;
}

/**
 * Create random particle angle for heart burst
 */
export function createParticleBurst(count: number = 8): number[] {
  return Array.from({ length: count }, (_, i) => (i / count) * 360);
}
