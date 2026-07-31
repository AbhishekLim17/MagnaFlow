import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import React from 'react';

// setTimeout fires immediately for delays past this, so it is the practical
// "never" for Radix's own auto-close. Dismissal timing is owned by the toast
// store; letting Radix run a second, independent 5s timer would close error
// toasts early no matter what duration the caller asked for.
const NEVER = 2147483647;

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, action, dismiss, duration, ...props }) => {
				return (
					<Toast
						key={id}
						duration={NEVER}
						// Fires for the close button, Escape, and swipe-to-dismiss, so
						// every way of closing a toast also removes it from the store.
						// Without this the toast vanished visually but stayed in state.
						onOpenChange={(open) => {
							if (!open) dismiss();
						}}
						{...props}
					>
						<div className="grid gap-1 pr-2">
							{title && <ToastTitle>{title}</ToastTitle>}
							{description && (
								<ToastDescription>{description}</ToastDescription>
							)}
						</div>
						{action}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
}
