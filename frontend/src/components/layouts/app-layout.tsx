import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import logoMark from '@/assets/logo-mark.svg';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  /** Shown in the header when known. */
  userName?: string;
  onLogout: () => void;
  children: ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
  );

/** The frame of every signed-in page: header with the brand, navigation and the account menu, then the content. */
export function AppLayout({ userName, onLogout, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <img src={logoMark} alt="" className="size-6 dark:invert" />
              FlowSync
            </Link>
            <nav aria-label="Main">
              <NavLink to="/projects" className={navLinkClass}>
                Projects
              </NavLink>
            </nav>
          </div>
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
