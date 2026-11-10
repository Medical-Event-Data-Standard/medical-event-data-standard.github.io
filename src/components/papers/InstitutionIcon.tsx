import React from 'react';
import { Avatar, type SxProps, type Theme } from '@mui/material';
import { useBaseUrlUtils } from '@docusaurus/useBaseUrl';

/**
 * An institution's icon (its website's icon, from static/img/institutions), or its initial if it has none. Shown
 * beside the institution's name, so it has no text alternative of its own.
 */
export default function InstitutionIcon({
  name,
  icon,
  size,
  className,
  sx,
}: {
  name: string;
  /** URL path of the icon, if the institution has one. */
  icon?: string;
  /** Width and height in pixels; when used as a Chip's avatar, the Chip sets them. */
  size?: number;
  /** Set by MUI when used as a Chip's avatar. */
  className?: string;
  sx?: SxProps<Theme>;
}): React.JSX.Element {
  const { withBaseUrl } = useBaseUrlUtils();
  const dimensions = size ? { width: size, height: size, fontSize: size * 0.6 } : {};
  return icon ? (
    <Avatar
      variant="rounded"
      alt=""
      src={withBaseUrl(icon)}
      className={className}
      sx={[{ ...dimensions, bgcolor: 'transparent', '& img': { objectFit: 'contain' } }, ...toArray(sx)]}
    />
  ) : (
    <Avatar aria-hidden className={className} sx={[dimensions, ...toArray(sx)]}>
      {name.charAt(0)}
    </Avatar>
  );
}

const toArray = (sx: SxProps<Theme> | undefined) => (Array.isArray(sx) ? sx : sx ? [sx] : []);
