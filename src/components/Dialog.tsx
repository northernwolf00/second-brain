import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, Dimensions, Platform, ScrollView,
} from 'react-native';
import Animated, {
  FadeIn, FadeOut, ZoomIn, ZoomOut,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Icon } from './Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  buttons?: DialogButton[];
  icon?: string;
  content?: React.ReactNode;
}

export function Dialog({ visible, onClose, title, message, buttons, icon, content }: Props) {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const handleButtonPress = (btn: DialogButton) => {
    if (btn.onPress) btn.onPress();
    onClose();
  };

  const defaultButtons: DialogButton[] = [{ text: 'OK', onPress: onClose }];
  const actionButtons = buttons && buttons.length > 0 ? buttons : defaultButtons;

  // Determine if buttons should be stacked or row
  const isStacked = actionButtons.length > 2 || actionButtons.some(b => b.text.length > 12);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop animation */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)' }]}>
          <Pressable style={styles.flex} onPress={onClose} />
        </Animated.View>

        {/* Dialog Content animation */}
        <Animated.View
          entering={ZoomIn.springify().damping(18).stiffness(150)}
          exiting={ZoomOut.duration(150)}
          style={[
            styles.dialog,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: '#000',
            },
          ]}>
          <ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
            {/* Header Icon */}
            {!!icon && (
              <View style={[styles.iconContainer, { backgroundColor: colors.accentSoft }]}>
                <Icon name={icon} size={32} color={colors.accent} />
              </View>
            )}

            {/* Text Content */}
            <View style={styles.textSection}>
              {!!title && (
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              )}
              {!!message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
              )}
            </View>

            {/* Custom Content Slot */}
            {!!content && (
              <View style={styles.customContent}>
                {content}
              </View>
            )}

            {/* Buttons */}
            <View style={[styles.buttonSection, isStacked ? styles.buttonsStacked : styles.buttonsRow]}>
              {actionButtons.map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const btnBg = isDestructive ? colors.danger : isCancel ? colors.surface : colors.accent;
                const textColor = (isDestructive || !isCancel) ? '#fff' : colors.text;

                return (
                  <TouchableOpacity
                    key={`${btn.text}-${idx}`}
                    style={[
                      styles.button,
                      isStacked ? styles.buttonFull : styles.buttonFlex,
                      { backgroundColor: btnBg, borderColor: colors.border },
                      isCancel && styles.buttonBordered,
                    ]}
                    onPress={() => handleButtonPress(btn)}
                    activeOpacity={0.8}>
                    <Text style={[styles.buttonText, { color: textColor }]}>{btn.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: { flex: 1 },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  textSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  customContent: {
    width: '100%',
    marginBottom: 20,
  },
  buttonSection: {
    width: '100%',
    gap: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
  },
  buttonsStacked: {
    flexDirection: 'column',
  },
  button: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonFull: {
    width: '100%',
  },
  buttonBordered: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
