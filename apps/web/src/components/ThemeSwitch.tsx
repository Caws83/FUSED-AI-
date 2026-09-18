"use client";

import { useTheme, type Theme } from "./ThemeProvider.tsx";

const OPTIONS: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fused-theme-switch" role="group" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="fused-theme-option"
          aria-pressed={theme === option.id}
          onClick={() => setTheme(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
