import logoMark from '@/assets/logo-mark.svg';
import { cn } from '@/lib/utils';

/** The FlowSync logo as a white glyph on the brand gradient, like an app icon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand-gradient shadow-sm',
        className,
      )}
    >
      <img src={logoMark} alt="" className="size-[62%] brightness-0 invert" />
    </span>
  );
}
