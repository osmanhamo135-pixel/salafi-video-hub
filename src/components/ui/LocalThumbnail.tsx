import React, { useEffect, useMemo, useState } from 'react';
import { Video } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface LocalThumbnailProps {
  path?: string | null;
  label: string;
  className?: string;
  iconClassName?: string;
  fallbackClassName?: string;
  loading?: 'lazy' | 'eager';
}

export const LocalThumbnail: React.FC<LocalThumbnailProps> = ({
  path,
  label,
  className = 'h-full w-full object-cover',
  iconClassName = 'h-6 w-6 text-muted-text/60',
  fallbackClassName = 'thumbnail-fallback',
  loading = 'lazy',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [path]);

  const src = useMemo(() => {
    if (!path || failed) return null;
    return convertFileSrc(path);
  }, [failed, path]);

  if (!src) {
    return (
      <div className={`thumbnail-fallback ${fallbackClassName}`} aria-label={label}>
        <div className="icon-medallion relative z-10 h-10 w-10">
          <Video className={iconClassName} />
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-label={label}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
};
