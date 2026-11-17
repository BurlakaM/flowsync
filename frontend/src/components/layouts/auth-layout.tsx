import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AuthHero } from './auth-hero';

interface AuthLayoutProps {
  title: string;
  description: string;
  /** A link to the neighbouring auth page. */
  footer: ReactNode;
  children: ReactNode;
}

/** The frame of the sign-in and sign-up pages: the brand side on wide screens, the form on the other. */
export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <AuthHero />
      <main className="relative flex flex-col bg-background px-6 py-6 sm:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-aurora" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <BrandMark />
            <span className="font-heading font-semibold tracking-tight">
              FlowSync
            </span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-sm flex-1 animate-fade-up flex-col justify-center py-10">
          {/* A real heading for screen readers (the card title is only a div). */}
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        </div>
      </main>
    </div>
  );
}
