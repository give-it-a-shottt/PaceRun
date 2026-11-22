import { createContext, useContext, type ReactNode } from 'react';

import { darkColors, lightColors, type Colors } from './tokens';

export type ThemeScheme = 'light' | 'dark';

type Theme = { scheme: ThemeScheme; colors: Colors };

const lightTheme: Theme = { scheme: 'light', colors: lightColors };
const darkTheme: Theme = { scheme: 'dark', colors: darkColors };

const ThemeContext = createContext<Theme>(lightTheme);

/**
 * 앱 기본은 Light다. Dark는 러닝 화면 묶음만 이 Provider로 감싸서 켠다
 * (pacerun-design.md 7장 "테마 적용 범위").
 */
export function ThemeProvider({ scheme, children }: { scheme: ThemeScheme; children: ReactNode }) {
  return (
    <ThemeContext.Provider value={scheme === 'dark' ? darkTheme : lightTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
