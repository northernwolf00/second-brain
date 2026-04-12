import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
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
import { BackupSetupScreen } from '../screens/BackupSetupScreen';
import { AIAssistantScreen } from '../screens/AIAssistantScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useTheme } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Notes:     'home',
  Graph:     'bubble-chart',
  Search:    'search',
  Resurface: 'auto-awesome',
  Settings:  'settings',
};

function wrap(Screen: React.ComponentType, label: string, useSafeArea = true) {
  return function WrappedScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    if (!useSafeArea) {
      return (
        <ErrorBoundary fallbackLabel={label}>
          <Screen />
        </ErrorBoundary>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ErrorBoundary fallbackLabel={label}>
          <Screen />
        </ErrorBoundary>
      </View>
    );
  };
}

function TabNavigator() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const iconName = TAB_ICONS[route.name] ?? 'circle';
          return (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: isDark ? 'rgba(56,139,253,0.15)' : 'rgba(139,111,71,0.15)' }
            ]}>
              <MaterialIcons
                name={iconName}
                size={23}
                color={focused ? (isDark ? colors.accent : colors.accent) : colors.muted}
              />
            </View>
          );
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 20,
          left: 16,
          right: 16,
          backgroundColor: isDark ? 'rgba(13, 17, 23, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderRadius: 28,
          height: 68,
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingHorizontal: 8,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
            },
            android: {
              elevation: 12,
            },
          }),
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: 10,
          marginTop: -2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        tabBarHideOnKeyboard: true,
      })}>
      <Tab.Screen name="Notes"     component={wrap(HomeScreen, 'Notes')} />
      <Tab.Screen name="Graph"     component={wrap(GraphScreen, 'Graph')} />
      <Tab.Screen name="Search"    component={wrap(SearchScreen, 'Search')} />
      <Tab.Screen name="Resurface" component={wrap(DailyResurfaceScreen, 'Resurface')} />
      <Tab.Screen name="Settings"  component={wrap(SettingsScreen, 'Settings')} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 60,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
});

export function RootNavigator() {
  const { isDark, colors } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary:      colors.accent,
      background:   colors.bg,
      card:         colors.surface,
      text:         colors.text,
      border:       colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackTitleVisible: false,
        }}>
        <Stack.Screen name="Main"        component={TabNavigator}                          options={{ headerShown: false }} />
        <Stack.Screen name="AddNote"     component={wrap(AddNoteScreen, 'AddNote')}        options={{ headerShown: false }} />
        <Stack.Screen name="Editor"      component={wrap(EditorScreen, 'Editor', false)}   options={{ title: 'Note' }} />
        <Stack.Screen name="BackupSetup"   component={wrap(BackupSetupScreen, 'BackupSetup')}     options={{ headerShown: false }} />
        <Stack.Screen name="AIAssistant"   component={wrap(AIAssistantScreen, 'AIAssistant', false)} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
