"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { Button } from "~~/components/ui/button";

export const SwitchTheme = ({ className }: { className?: string }) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDarkMode = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(isDarkMode ? "light" : "dark")}
        aria-label={`Cambiar al tema ${isDarkMode ? "claro" : "oscuro"}`}
      >
        {isDarkMode ? <SunIcon /> : <MoonIcon />}
      </Button>
    </div>
  );
};
