import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';

export function CommandControlTheme({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{
    token: {
      colorPrimary: '#1677ff',
      colorBgContainer: 'var(--background)',
      colorBgElevated: 'var(--popover)',
      colorText: 'var(--foreground)',
      colorTextDescription: 'var(--muted-foreground)',
      colorTextPlaceholder: 'var(--muted-foreground)',
      colorTextDisabled: 'var(--muted-foreground)',
      colorBorder: 'var(--border)',
      colorFillSecondary: 'var(--muted)',
      colorBgContainerDisabled: 'var(--muted)',
      borderRadius: 6,
      controlHeight: 32,
      fontFamily: 'inherit',
      fontSize: 13,
    },
    components: {
      Slider: { railBg: 'var(--border)', railHoverBg: 'var(--muted-foreground)', trackBg: '#69b1ff', trackHoverBg: '#1677ff', handleColor: '#69b1ff', handleActiveColor: '#1677ff' },
      Switch: { colorTextQuaternary: 'var(--muted-foreground)', colorTextTertiary: 'var(--muted-foreground)' },
    },
  }}>{children}</ConfigProvider>;
}
