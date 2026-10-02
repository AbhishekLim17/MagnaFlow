// A promise-based confirmation dialog, to replace the browser's window.confirm().
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Delete this task?', destructive: true }))) return;
//
// The native confirm() is a grey system box that ignores the theme and the product's
// wording, cannot say anything useful about consequences, is blocked inside some
// embedded browsers, and looks different on every platform. This one is themed,
// keyboard-accessible (focus lands on Cancel for destructive actions, Escape cancels)
// and shows exactly what is about to happen.
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within a ConfirmProvider');
  return confirm;
};

const DEFAULTS = {
  title: 'Are you sure?',
  description: null,
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
};

export const ConfirmProvider = ({ children }) => {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    // A second request while one is open cancels the first rather than leaving it hanging.
    if (resolver.current) resolver.current(false);
    resolver.current = resolve;
    setOptions({ ...DEFAULTS, ...opts });
  }), []);

  const settle = (answer) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOptions(null);
    if (resolve) resolve(answer);
  };

  const open = options !== null;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => { if (!next) settle(false); }}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && (
              <AlertDialogDescription asChild>
                <div className="space-y-2">{options.description}</div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{options?.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={options?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
            >
              {options?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};
