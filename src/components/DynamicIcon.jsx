import React from 'react';
import * as MuiIcons from '@mui/icons-material';

export default function DynamicIcon({ iconName, ...props }) {
  const IconComponent = MuiIcons[iconName];

  if (!IconComponent) return null; // Icon doesn't exist

  return <IconComponent {...props} />;
}

