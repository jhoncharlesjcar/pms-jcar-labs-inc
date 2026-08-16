import { Check, CreditCard, ReceiptText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
    { key: 'review', label: 'Revisar', icon: ReceiptText },
    { key: 'payment', label: 'Cobrar', icon: CreditCard },
    { key: 'complete', label: 'Finalizar', icon: Sparkles },
];

export default function CheckoutProgress({ current = 'payment' }) {
    const currentIndex = STEPS.findIndex(step => step.key === current);

    return (
        <ol className="grid grid-cols-3 gap-2" aria-label="Progreso del checkout">
            {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isComplete = index < currentIndex || current === 'complete';
                const isCurrent = index === currentIndex && current !== 'complete';

                return (
                    <li
                        key={step.key}
                        aria-current={isCurrent ? 'step' : undefined}
                        className={cn(
                            'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold',
                            isComplete && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                            isCurrent && 'border-primary/25 bg-primary/10 text-primary',
                            !isComplete && !isCurrent && 'border-border/60 bg-muted/20 text-muted-foreground'
                        )}
                    >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/70">
                            {isComplete ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{step.label}</span>
                    </li>
                );
            })}
        </ol>
    );
}
