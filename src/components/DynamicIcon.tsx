import React from 'react';
import * as MuiIcons from '@mui/icons-material';

interface DynamicIconProps {
  iconName: keyof typeof MuiIcons; // The name of the icon to render
  [key: string]: any; // Allow any other props
}

export default function DynamicIcon({ iconName, ...props }: DynamicIconProps): React.JSX.Element | null {
  const IconComponent = MuiIcons[iconName];

  if (!IconComponent) return null; // Icon doesn't exist

  return <IconComponent {...props} />;
}
