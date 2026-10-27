import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" onClick={toggle} aria-label={`Switch to ${next} mode`}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Switch to {next} mode</TooltipContent>
    </Tooltip>
  );
}
