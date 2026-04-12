import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
}

export interface AlertOptions {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: string;
  content?: ReactNode;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {/* The Dialog component will be rendered here, listening to the state */}
      {/* For now, we'll just expose the state via context and render the component in App.tsx or here after we create it */}
      {options && (
        <DialogContainer
          visible={visible}
          options={options}
          onClose={hideAlert}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

// Internal component to handle the dialog rendering
import { Dialog } from '../components/Dialog';

function DialogContainer({ visible, options, onClose }: { visible: boolean; options: AlertOptions; onClose: () => void }) {
  return (
    <Dialog
      visible={visible}
      title={options.title}
      message={options.message}
      buttons={options.buttons}
      icon={options.icon}
      content={options.content}
      onClose={onClose}
    />
  );
}
