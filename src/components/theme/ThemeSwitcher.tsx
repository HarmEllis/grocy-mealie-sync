"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const modes = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <span className="size-4" />
      </Button>
    );
  }

  const current = modes.find((m) => m.value === theme) ?? modes[2];
  const next = modes[(modes.findIndex((m) => m.value === theme) + 1) % modes.length];

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => setTheme(next.value)}
      aria-label={`Switch to ${next.label} mode`}
      title={`${current.label} mode — click for ${next.label}`}
    >
      <current.icon className="size-4" />
    </Button>
  );
}
