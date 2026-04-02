import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { EditorScreen } from '../screens/EditorScreen';
import { GraphScreen } from '../screens/GraphScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DailyResurfaceScreen } from '../screens/DailyResurfaceScreen';

const COLORS = { bg: '#0f0f0f', card: '#1a1a1a', accent: '#7c6af7', text: '#f0f0f0', muted: '#555', border: '#2a2a2a' };

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_THEME = {
  dark: true,
  colors: {
    primary: COLORS.accent,
    background: COLORS.bg,
    card: COLORS.card,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.accent,
  },
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Notes: '📝',
    Graph: '🕸',
    Search: '🔍',
    Resurface: '✨',
    Settings: '⚙️',
  };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>
      {icons[name] ?? '●'}
    </Text>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 10 },
      })}>
      <Tab.Screen name="Notes" component={HomeScreen} />
      <Tab.Screen name="Graph" component={GraphScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Resurface" component={DailyResurfaceScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={NAV_THEME as any}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.card },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen
          name="Editor"
          component={EditorScreen}
          options={{ title: 'Note' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
