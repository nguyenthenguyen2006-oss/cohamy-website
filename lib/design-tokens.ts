import type { DesignTokens } from "./types";

export const designTokens: DesignTokens = {
  colors: {
    chocolate: "#4A2418",
    deepCocoa: "#2A120C",
    gold: "#D9A441",
    cream: "#FFF4D8",
    warmWhite: "#FAF6EF",
  },
  typography: {
    fontFamily: {
      sans: "var(--font-geist-sans), system-ui, sans-serif",
      serif: "var(--font-playfair), Georgia, serif",
      display: "var(--font-playfair), Georgia, serif",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
    letterSpacing: {
      tight: "-0.025em",
      normal: "0",
      wide: "0.025em",
      wider: "0.05em",
      widest: "0.1em",
    },
  },
  spacing: {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.25rem",
    "6": "1.5rem",
    "8": "2rem",
    "10": "2.5rem",
    "12": "3rem",
    "16": "4rem",
    "20": "5rem",
    "24": "6rem",
    "32": "8rem",
  },
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    "2xl": "1.5rem",
    full: "9999px",
  },
  shadow: {
    sm: "0 1px 2px 0 rgba(42, 18, 12, 0.05)",
    md: "0 4px 6px -1px rgba(42, 18, 12, 0.1), 0 2px 4px -2px rgba(42, 18, 12, 0.1)",
    lg: "0 10px 15px -3px rgba(42, 18, 12, 0.1), 0 4px 6px -4px rgba(42, 18, 12, 0.1)",
    xl: "0 20px 25px -5px rgba(42, 18, 12, 0.1), 0 8px 10px -6px rgba(42, 18, 12, 0.1)",
    gold: "0 4px 14px 0 rgba(217, 164, 65, 0.25)",
  },
  motion: {
    duration: {
      fast: "150ms",
      normal: "250ms",
      slow: "400ms",
      slower: "600ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
  },
} as const;

export const colors = designTokens.colors;
export const typography = designTokens.typography;
export const spacing = designTokens.spacing;
export const radius = designTokens.radius;
export const shadow = designTokens.shadow;
export const motion = designTokens.motion;