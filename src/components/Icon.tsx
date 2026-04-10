import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';

type IconFamily = 'material' | 'ion';

interface Props {
  family?: IconFamily;
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ family = 'material', name, size = 22, color = '#f0f0f0' }: Props) {
  if (family === 'ion') {
    return <Ionicons name={name as any} size={size} color={color} />;
  }
  return <MaterialIcons name={name as any} size={size} color={color} />;
}
