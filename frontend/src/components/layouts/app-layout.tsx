import { FolderKanban, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  /** Shown in the header when known. */
  userName?: string;
  onLogout: () => void;
  /** Extra items of the main navigation, supplied by the app (for example the notifications bell). */
  navExtra?: ReactNode;
  children: ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent/70 hover:text-accent-foreground',
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
  );

/** The frame of every signed-in page: a header that stays on top, then the content over a soft glow. */
export function AppLayout({
  userName,
  onLogout,
  navExtra,
  children,
}: AppLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-112 bg-aurora" />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-lg font-heading text-lg font-semibold tracking-tight"
            >
              <BrandMark />
              <span className="hidden sm:inline">FlowSync</span>
            </Link>
            <nav aria-label={t('Main')} className="flex items-center gap-1">
              <NavLink to="/projects" className={navLinkClass}>
                <FolderKanban aria-hidden="true" className="size-4" />
                <span className="max-sm:sr-only">{t('Projects')}</span>
              </NavLink>
              {navExtra}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <span
              aria-hidden="true"
              className="mx-2 hidden h-5 w-px bg-border sm:block"
            />
            {userName && (
              <div className="flex items-center gap-2.5 pr-1">
                <Avatar name={userName} decorative />
                <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
                  {userName}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Sign out')}
              title={t('Sign out')}
              onClick={onLogout}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
