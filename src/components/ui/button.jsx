import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

// Heights sit on the 8px grid (36/44/48) so a button always aligns with the
// inputs and cards beside it. Every variant shares the same radius, weight and
// easing — the only thing that changes between them is emphasis.
const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap ' +
		'transition-all duration-200 ease-premium ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'disabled:pointer-events-none disabled:opacity-50 ' +
		'active:scale-[0.98] ' +
		'[&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground shadow-card hover:bg-primary/90 hover:shadow-float',
				destructive:
					'bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90 hover:shadow-float',
				success:
					'bg-success text-success-foreground shadow-card hover:bg-success/90 hover:shadow-float',
				outline:
					'border border-border bg-card text-foreground shadow-card hover:bg-muted',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
				soft: 'bg-primary-soft text-primary hover:bg-primary/15',
				ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-11 px-5',
				sm: 'h-9 px-4 text-[13px]',
				lg: 'h-12 px-7 text-base',
				icon: 'h-11 w-11',
				'icon-sm': 'h-9 w-9',
			},
			// The reference uses fully-rounded pills for navigation and for
			// secondary actions sitting inside a card.
			pill: {
				true: 'rounded-full',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(
	({ className, variant, size, pill, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button';
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, pill, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = 'Button';

export { Button, buttonVariants };
