import React from 'react';

/**
 * A miniature of the actual app, rendered in a given theme.
 *
 * The picker used to show three 12px swatches taken from a hardcoded hex array
 * in `i18n.ts` — the last literal colours in the codebase, and the only place
 * left that could silently disagree with what a theme really looks like. Those
 * hexes had in fact gone stale: they still described the era when eight of the
 * ten themes resolved the same gold accent.
 *
 * This cannot go stale by construction. `data-theme` on the wrapper re-scopes
 * every custom property the real UI uses, so the preview is drawn from the
 * theme's own tokens. Change a theme and its preview changes with it; add an
 * eleventh theme and it gets a correct preview for free.
 *
 * It is decorative — the option's accessible name is the theme's title, and
 * this is `aria-hidden`. There is no text to read here, only colour.
 */
export const ThemePreview: React.FC<{ theme: string; className?: string }> = ({
  theme,
  className,
}) => (
  <span
    data-theme={theme}
    aria-hidden="true"
    className={`theme-preview ${className ?? ''}`}
  >
    {/* sidebar */}
    <span className="tp-side">
      <span className="tp-brand" />
      <span className="tp-nav tp-nav-active" />
      <span className="tp-nav" />
      <span className="tp-nav" />
    </span>

    {/* content: a hero band, a framed card with an accent action, a rail */}
    <span className="tp-main">
      <span className="tp-hero" />
      <span className="tp-card">
        <span className="tp-art" />
        <span className="tp-lines">
          <span className="tp-line tp-line-lg" />
          <span className="tp-line" />
          <span className="tp-cta" />
        </span>
      </span>
      <span className="tp-rail">
        <span className="tp-tile" />
        <span className="tp-tile" />
        <span className="tp-tile" />
      </span>
    </span>
  </span>
);
