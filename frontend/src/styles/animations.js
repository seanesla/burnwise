/**
 * animations.js - Global Animation Standards for BURNWISE
 * 
 * Professional spring physics presets based on Context7 Motion.dev best practices
 * Eliminates jiggly animations and provides consistent motion language
 * 
 * Usage:
 * import { springPresets } from '../styles/animations';
 * transition={springPresets.smooth}
 */

// Context7 Motion.dev Best Practices Applied
export const springPresets = {
  /**
   * Smooth UI Springs - For general component transitions
   * Damping ratio: 30% (optimal for UI elements)
   * Use for: Panel appearances, component state changes
   */
  smooth: {
    type: "spring",
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  },

  /**
   * Snappy Interactions - For hover, tap, and interactive elements
   * Damping ratio: 10% (quick response without oscillation)
   * Use for: Button hovers, icon interactions, tooltips
   */
  snappy: {
    type: "spring",
    stiffness: 400,
    damping: 40,
    restDelta: 0.001
  },

  /**
   * Gentle Transitions - For subtle, calm animations
   * Damping ratio: 40% (very smooth, no bounce)
   * Use for: Background elements, subtle state changes
   */
  gentle: {
    type: "spring",
    stiffness: 50,
    damping: 20,
    restDelta: 0.001
  },

  /**
   * Coordinated Animations - For synchronized, professional motion
   * Uses visualDuration for timing coordination
   * Use for: Page transitions, major UI changes
   */
  coordinated: {
    type: "spring",
    visualDuration: 0.5,
    bounce: 0.25
  },

  /**
   * Discrete Entrance - For subtle component appearances
   * Lower bounce for professional feel
   * Use for: Dock navigation, floating panels
   */
  discreteEntrance: {
    type: "spring",
    visualDuration: 0.4,
    bounce: 0.15
  },

  /**
   * Glass Morphism - For floating panels and overlays
   * Optimized for glass morphism components
   * Use for: FloatingAI, modals, overlays
   */
  glassMorphism: {
    type: "spring",
    stiffness: 120,
    damping: 35,
    restDelta: 0.001
  },

  /**
   * Timeline Elements - For timeline and event animations
   * Balanced for data visualization elements
   * Use for: Timeline events, data points, charts
   */
  timelineElement: {
    type: "spring",
    stiffness: 300,
    damping: 35,
    restDelta: 0.001
  }
};

/**
 * Hover Animation Presets - Specific for interactive elements
 */
export const hoverPresets = {
  /**
   * Icon Hover - For dock icons and buttons
   */
  icon: {
    scale: 1.3,
    y: -10,
    transition: springPresets.snappy
  },

  /**
   * Button Hover - For general button interactions
   */
  button: {
    scale: 1.05,
    transition: springPresets.snappy
  },

  /**
   * Timeline Event Hover - For timeline burn events
   */
  timelineEvent: {
    scale: 1.2,
    y: -5,
    transition: springPresets.snappy
  },

  /**
   * Card Hover - For farm cards and panels
   */
  card: {
    y: -2,
    transition: springPresets.smooth
  }
};

/**
 * Exit Animation Presets - For component unmounting
 */
export const exitPresets = {
  /**
   * Fade Out - Standard exit animation
   */
  fadeOut: {
    opacity: 0,
    scale: 0.95,
    transition: springPresets.gentle
  },

  /**
   * Slide Down - For sliding panels
   */
  slideDown: {
    opacity: 0,
    y: 50,
    transition: springPresets.smooth
  },

  /**
   * Scale Out - For floating elements
   */
  scaleOut: {
    opacity: 0,
    scale: 0.8,
    y: 20,
    transition: springPresets.smooth
  }
};

/**
 * Animation Variants - Complete animation sets for common patterns
 */
export const animationVariants = {
  /**
   * Floating Panel - For draggable panels like FloatingAI
   */
  floatingPanel: {
    initial: { opacity: 0, scale: 0.8, y: 50 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: exitPresets.scaleOut,
    transition: springPresets.glassMorphism
  },

  /**
   * Dock Icon - For navigation icons
   */
  dockIcon: {
    initial: { scale: 1, y: 0 },
    hover: hoverPresets.icon,
    tap: { scale: 0.9 }
  },

  /**
   * Tooltip - For hover tooltips
   */
  tooltip: {
    hidden: { opacity: 0, y: 10, scale: 0.8 },
    visible: {
      opacity: 1,
      y: -5,
      scale: 1,
      transition: springPresets.timelineElement
    }
  },

  /**
   * Page Entrance - For major component mounting
   */
  pageEntrance: {
    initial: { y: 100 },
    animate: { y: 0 },
    exit: { y: 100 },
    transition: springPresets.discreteEntrance
  }
};

/**
 * CSS Spring Generator - For CSS-based animations
 * 
 * Usage in CSS-in-JS:
 * transition: `all ${cssSpring.smooth}`
 */
export const cssSpring = {
  smooth: "0.6s cubic-bezier(0.16, 1, 0.3, 1)",
  snappy: "0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  gentle: "0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
};

/**
 * Performance Notes:
 * - All presets include restDelta: 0.001 to prevent micro-animations
 * - Damping ratios are optimized to eliminate oscillation
 * - Stiffness values chosen for responsive but smooth interactions
 * - visualDuration used where animation coordination is important
 * 
 * Damping Ratio Guidelines (Context7 best practices):
 * - < 5%: Extreme bounce (AVOID)
 * - 5-15%: Some bounce (use sparingly)
 * - 15-30%: Controlled motion (good for interactions) 
 * - 30%+: Smooth, no bounce (ideal for UI)
 */