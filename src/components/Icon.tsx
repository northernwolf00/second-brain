import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

type IconFamily = 'material' | 'ion';

interface Props {
  family?: IconFamily;
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ family = 'material', name, size = 22, color = '#f0f0f0' }: Props) {
  if (family === 'ion') {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return <MaterialIcons name={name} size={size} color={color} />;
}
