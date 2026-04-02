import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { HomeScreen } from '../screens/HomeScreen';
import { EditorScreen } from '../screens/EditorScreen';
import { GraphScreen } from '../screens/GraphScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DailyResurfaceScreen } from '../screens/DailyResurfaceScreen';
import { AddNoteScreen } from '../screens/AddNoteScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';

const C = {
  bg: '#0f0f0f',
  card: '#1a1a1a',
  accent: '#7c6af7',
  text: '#f0f0f0',
  muted: '#555',
  border: '#2a2a2a',
};

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: C.accent,
    background: C.bg,
    card: C.card,
    text: C.text,
    border: C.border,
    notification: C.accent,
  },
};

// Tab icon map — MaterialIcons names
const TAB_ICONS: Record<string, string> = {
  Notes: 'home',
  Graph: 'bubble-chart',
  Search: 'search',
  Resurface: 'auto-awesome',
  Settings: 'settings',
};

function wrap(Screen: React.ComponentType, label: string) {
  return function WrappedScreen() {
    return (
      <ErrorBoundary fallbackLabel={label}>
        <Screen />
      </ErrorBoundary>
    );
  };
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => (
          <MaterialIcons
            name={TAB_ICONS[route.name] ?? 'circle'}
            size={size}
            color={focused ? C.accent : C.muted}
          />
        ),
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10 },
      })}>
      <Tab.Screen name="Notes"     component={wrap(HomeScreen, 'Notes')} />
      <Tab.Screen name="Graph"     component={wrap(GraphScreen, 'Graph')} />
      <Tab.Screen name="Search"    component={wrap(SearchScreen, 'Search')} />
      <Tab.Screen name="Resurface" component={wrap(DailyResurfaceScreen, 'Resurface')} />
      <Tab.Screen name="Settings"  component={wrap(SettingsScreen, 'Settings')} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: C.card },
          headerTintColor: C.text,
          headerShadowVisible: false,
        }}>
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddNote"
          component={wrap(AddNoteScreen, 'AddNote')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Editor"
          component={wrap(EditorScreen, 'Editor')}
          options={{ title: 'Note' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
