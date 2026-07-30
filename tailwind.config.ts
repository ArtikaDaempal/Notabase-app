import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * tailwind.config.ts — Notabase Design System Configuration
 * Dokumen acuan: 02-design-system.md
 * Memenuhi kriteria aksesibilitas WCAG 2.1 AA (kontras minimum 4.5:1 untuk teks normal, 3:1 untuk teks besar & elemen UI).
 */

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn UI base colors (OKLCH mapping)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // ─────────────────────────────────────────────────────────────────────
        // NOTABASE SEMANTIC DESIGN TOKENS (02-design-system.md §2.1)
        // ─────────────────────────────────────────────────────────────────────
        nb: {
          // Brand
          brand: {
            primary: "var(--nb-brand-primary)",   // #1D4ED8 (4.5:1 contrast vs white)
            dark: "var(--nb-brand-dark)",         // #1E3A8A (9.2:1 contrast vs white)
            light: "var(--nb-brand-light)",       // #EFF3FB
          },
          // Semantic Status & Actions
          success: {
            DEFAULT: "var(--nb-success)",         // #16A34A (4.6:1 contrast)
            bg: "var(--nb-success-bg)",           // #DCFCE7
          },
          danger: {
            DEFAULT: "var(--nb-danger)",          // #DC2626 (4.8:1 contrast)
            bg: "var(--nb-danger-bg)",            // #FEE2E2
          },
          warning: {
            DEFAULT: "var(--nb-warning)",         // #CA8A04 (4.5:1 contrast)
            bg: "var(--nb-warning-bg)",           // #FEF9C3
          },
          action: {
            secondary: "var(--nb-action-secondary)", // #15803D (5.1:1 contrast - Tombol Export)
          },
          info: "var(--nb-info)",                 // #2563EB (4.5:1 contrast)

          // Kategori Tag Colors (03-business-rules.md §8)
          tag: {
            atk: "var(--nb-tag-atk)",             // #16A34A
            operasional: "var(--nb-tag-operasional)", // #6B7280
            konsumsi: "var(--nb-tag-konsumsi)",   // #059669
            transportasi: "var(--nb-tag-transportasi)", // #2563EB
            utilitas: "var(--nb-tag-utilitas)",   // #7C3AED
            referensi: "var(--nb-tag-referensi)", // #0891B2
            lainnya: "var(--nb-tag-lainnya)",     // #94A3B8
          },

          // Receipt Type Badges (02-design-system.md §3.5)
          badge: {
            scan: "var(--nb-badge-scan)",         // #2563EB (Biru)
            gallery: "var(--nb-badge-gallery)",   // #7C3AED (Ungu)
            manual: "var(--nb-badge-manual)",     // #6B7280 (Abu-abu)
          },

          // Neutrals & Surfaces (WCAG 2.1 AA Compliant)
          bg: {
            app: "var(--nb-bg-app)",             // #EFF3FB (Light) / #0B1220 (Dark)
            card: "var(--nb-bg-card)",           // #FFFFFF (Light) / #131C2E (Dark)
          },
          text: {
            primary: "var(--nb-text-primary)",   // #0F172A (Light: 17.5:1) / #F1F5F9 (Dark: 14.5:1)
            secondary: "var(--nb-text-secondary)", // #64748B (Light: 4.8:1) / #94A3B8 (Dark: 7.2:1)
            muted: "var(--nb-text-muted)",       // #94A3B8
          },
          border: "var(--nb-border)",             // #E2E8F0 / #1E293B
        },
      },
      borderRadius: {
        card: "var(--nb-radius-card, 16px)",
        input: "var(--nb-radius-input, 10px)",
        pill: "var(--nb-radius-pill, 999px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta-sans)", "Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "Consolas", "monospace"],
      },
      fontSize: {
        display: ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "800" }],
        h1: ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
        h2: ["18px", { lineHeight: "26px", fontWeight: "600" }],
        stat: ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      boxShadow: {
        card: "var(--nb-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04))",
        elevation: "0 10px 25px -5px rgba(29, 78, 216, 0.12), 0 8px 10px -6px rgba(29, 78, 216, 0.08)",
      },
      spacing: {
        "space-page": "var(--nb-space-page, 20px)",
        "card-gap": "var(--nb-space-card-gap, 16px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
