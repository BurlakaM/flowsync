import type { ReactNode } from 'react';
import { Link } from 'react-router';
import logoMark from '@/assets/logo-mark.svg';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  /** Shown in the header when known. */
  userName?: string;
  onLogout: () => void;
  children: ReactNode;
}

/** The frame of every signed-in page: header with the brand and the account menu, then the content. */
export function AppLayout({ userName, onLogout, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src={logoMark} alt="" className="size-6 dark:invert" />
            FlowSync
          </Link>
          <div className="flex items-center gap-3">
            {userName && (
              <span className="text-sm text-muted-foreground">{userName}</span>
            )}
            <Button variant="outline" size="sm" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
