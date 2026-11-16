import { LanguageSwitcher } from '@/components/language-switcher';
import type { ReactNode } from 'react';
import logoMark from '@/assets/logo-mark.svg';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthLayoutProps {
  title: string;
  description: string;
  /** A link to the neighbouring auth page. */
  footer: ReactNode;
  children: ReactNode;
}

/** The frame of the sign-in and sign-up pages: a centred card with the brand. */
export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={logoMark} alt="" className="mb-2 size-10 dark:invert" />
          {/* CardTitle is a div: the page needs a real heading for screen readers. */}
          <CardTitle className="text-xl">
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      </Card>
    </main>
  );
}
