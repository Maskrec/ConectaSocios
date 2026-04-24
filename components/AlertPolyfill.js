import { Alert as NativeAlert, Platform } from 'react-native';

const AlertPolyfill = {
  alert: (title, message, buttons, options) => {
    if (Platform.OS === 'web') {
      if (buttons === undefined || buttons.length === 0) {
        window.alert([title, message].filter(Boolean).join('\n'));
        return;
      }
      if (buttons.length === 1) {
        window.alert([title, message].filter(Boolean).join('\n'));
        const onPress = buttons[0].onPress;
        if (onPress) {
          onPress();
        }
        return;
      }
      // Para múltiples botones, simulamos una ventana de confirmación
      const confirmBtn = buttons.find(b => b.style !== 'cancel') || buttons[1];
      const cancelBtn = buttons.find(b => b.style === 'cancel') || buttons[0];
      
      const result = window.confirm([title, message].filter(Boolean).join('\n'));
      if (result) {
        if (confirmBtn && confirmBtn.onPress) confirmBtn.onPress();
      } else {
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
    } else {
      NativeAlert.alert(title, message, buttons, options);
    }
  },
};

export default AlertPolyfill;