import React from 'react';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';

/**
 * Spring physics, scoped deliberately.
 *
 * The app already has a four-tier duration system with full reduced-motion
 * coverage, and CSS owns every hover and press. Framer-motion is here for the
 * one thing CSS does badly: interruptible, velocity-preserving motion when a
 * card is picked up or a surface enters. A spring that can be caught mid-flight
 * feels tactile; a 200ms ease that restarts feels like a slideshow.
 *
 * What it must never touch: the Basmala, the mushaf reading surface, and the
 * ayah text. Those are static by rule, and nothing in this file is wired to
 * them.
 */

/** Fluent-ish, but as physics rather than duration. Critically damped enough
 *  not to overshoot into a bounce — a reverent app should not boing. */
export const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 };
export const SPRING_SOFT = { type: 'spring' as const, stiffness: 260, damping: 30, mass: 1 };

/**
 * Wraps the app so every motion component inherits reduced-motion handling
 * from one place rather than each call site remembering.
 */
export const SpringProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user" transition={SPRING}>
    {children}
  </MotionConfig>
);

/**
 * A surface that lifts under the cursor and settles when released.
 *
 * `whileHover` and `whileTap` are transform-only, so this composites rather
 * than repaints — it can sit on a card carrying a backdrop-filter without
 * forcing the blur to re-resolve every frame.
 */
export const LiftCard: React.FC<
  { children: React.ReactNode; className?: string } & React.ComponentProps<typeof motion.div>
> = ({ children, className, ...rest }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduced ? undefined : { y: -3, scale: 1.006 }}
      whileTap={reduced ? undefined : { scale: 0.997 }}
      transition={SPRING}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

/**
 * Entry for a surface that genuinely arrives — a modal, a sheet, the featured
 * card on first paint. Not applied per-route: the page background is
 * continuous and content that slides in on every navigation is the house style
 * of dashboard templates.
 */
export const RiseIn: React.FC<
  { children: React.ReactNode; className?: string; delay?: number }
> = ({ children, className, delay = 0 }) => {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SOFT, delay }}
    >
      {children}
    </motion.div>
  );
};
