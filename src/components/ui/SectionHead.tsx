import React from 'react';
import { useI18n } from '@/i18n';

/**
 * The one header shape for a content-bearing section: a small accent eyebrow
 * over a display-weight title, closed by the directional hairline the app
 * rules its pages with.
 *
 * The eyebrow renders for Latin only. It repeats the title in small tracked
 * caps — a rubric, legible as ornament because case, size and colour all
 * change — but Arabic has no case, so the same device there would read as the
 * line printing twice. It is aria-hidden either way; the h2 carries the name.
 *
 * Latin titles set in Plex Serif (the display family); Arabic keeps the UI
 * face at its own leading, and the global rule zeroes its tracking.
 */
export const SectionHead: React.FC<{
  title: string;
  meta?: React.ReactNode;
  className?: string;
}> = ({ title, meta, className = '' }) => {
  const { language } = useI18n();
  const isArabic = language === 'ar';

  return (
    <div className={`section-head ${className}`}>
      <div className="min-w-0">
        {!isArabic && (
          <p aria-hidden="true" className="section-eyebrow">
            {title}
          </p>
        )}
        <h2 className={`section-title ${isArabic ? '' : 'section-title-latin'} truncate`}>
          {title}
        </h2>
      </div>
      {meta !== undefined && meta !== null && <div className="section-meta">{meta}</div>}
    </div>
  );
};
