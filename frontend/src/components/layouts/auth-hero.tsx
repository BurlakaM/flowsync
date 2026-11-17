import { Columns3, Search, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/brand-mark';
import { tKey } from '@/i18n/t-key';
import { cn } from '@/lib/utils';

const COLUMNS = [
  { label: tKey('To do'), dot: 'bg-slate-300', cards: 2 },
  { label: tKey('In progress'), dot: 'bg-amber-300', cards: 1 },
  { label: tKey('Done'), dot: 'bg-emerald-300', cards: 2 },
] as const;

/**
 * The brand side of the sign-in pages. It is decoration (hidden from screen readers): a miniature board where
 * one card travels from "To do" to "Done", which is the whole idea of the product in nine seconds.
 */
export function AuthHero() {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden="true"
      className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden bg-[oklch(0.2_0.07_277)] p-12 text-white lg:flex xl:p-16"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_15%_5%,oklch(0.55_0.23_277/0.85),transparent_70%),radial-gradient(60%_50%_at_95%_35%,oklch(0.7_0.13_185/0.5),transparent_70%),radial-gradient(70%_60%_at_45%_115%,oklch(0.5_0.2_305/0.7),transparent_70%)]" />
      <div className="absolute inset-0 -z-10 [mask-image:radial-gradient(75%_65%_at_50%_45%,black,transparent)] bg-[radial-gradient(oklch(1_0_0/0.16)_1px,transparent_1px)] bg-size-[22px_22px]" />

      <div className="flex items-center gap-3">
        <BrandMark className="size-10 rounded-xl shadow-glow" />
        <span className="font-heading text-xl font-semibold tracking-tight">
          FlowSync
        </span>
      </div>

      <div className="space-y-10">
        <div className="max-w-lg space-y-4">
          <p className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">
            {t('Keep every task in flow.')}
          </p>
          <p className="text-lg text-white/70">
            {t('Projects, boards and your team in one calm place.')}
          </p>
        </div>

        <div className="relative max-w-xl animate-float rounded-3xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
          <div className="relative">
            <div className="grid grid-cols-3 gap-3">
              {COLUMNS.map((column) => (
                <div
                  key={column.label}
                  className="rounded-2xl bg-white/[0.07] p-2.5"
                >
                  <div className="mb-2 flex h-6 items-center gap-1.5 text-xs font-medium text-white/80">
                    <span className={cn('size-2 rounded-full', column.dot)} />
                    {t(column.label)}
                  </div>
                  {/* The place the traveling card lands in. */}
                  <div className="h-[4.5rem] rounded-xl border border-dashed border-white/20" />
                  {Array.from({ length: column.cards }, (_, index) => (
                    <div
                      key={index}
                      className="mt-2 h-14 space-y-2 rounded-xl bg-white/[0.12] p-2.5"
                    >
                      <div className="h-2 w-4/5 rounded bg-white/35" />
                      <div className="h-2 w-1/2 rounded bg-white/20" />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="absolute top-[2.625rem] left-0 w-[calc((100%-1.5rem)/3)] animate-flow-card">
              <div className="h-[4.5rem] space-y-2 rounded-xl bg-white p-2.5 shadow-xl">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 animate-flow-dot rounded-full" />
                  <span className="h-2 w-3/5 rounded bg-slate-300" />
                </div>
                <div className="h-2 w-4/5 rounded bg-slate-200" />
                <div className="flex items-center justify-between">
                  <span className="h-3.5 w-10 rounded-full bg-indigo-100" />
                  <span className="size-4 rounded-full bg-linear-to-br from-indigo-500 to-violet-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="grid max-w-xl grid-cols-3 gap-4 text-sm text-white/75">
        {[
          { icon: Columns3, text: t('Drag-and-drop board') },
          { icon: Zap, text: t('Live updates') },
          { icon: Search, text: t('Fast search') },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
              <Icon className="size-4" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
