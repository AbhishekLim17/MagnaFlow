// A password input that helps: show/hide, optionally generate-and-copy, and a plain
// statement of the rule with a strength rating.
//
// The add-staff and add-admin dialogs used to hand the admin an empty box labelled
// "Password" with no rule and no way to see what they typed, then fail with a Firebase
// error if it was short. An admin creating someone else's account also has to pass the
// password on, so `generate` gives them a good one and a Copy button.

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MIN_PASSWORD_LENGTH, generatePassword, passwordStrength } from '@/lib/password';

const METER = ['bg-destructive', 'bg-warning', 'bg-info', 'bg-success'];
const METER_TEXT = ['text-destructive', 'text-warning', 'text-info', 'text-success'];

/**
 * @param {string}   id
 * @param {string}   label
 * @param {string}   value
 * @param {Function} onChange          called with the new string (not the event)
 * @param {boolean}  [generate]        offer "Generate" and "Copy" (for setting someone else's password)
 * @param {boolean}  [showStrength]    show the rule and a strength rating (for choosing a new password)
 * @param {string}   [email]           the account's email, so a password built from it is flagged
 * @param {string}   [error]           inline error; wired to the input with aria-describedby
 * @param {string}   [hint]            replaces the default requirement text; pass "" for none
 * @param {string}   [autoComplete]    defaults to "new-password" so browsers do not fill in the admin's own
 */
const PasswordField = ({
  id,
  label = 'Password',
  value,
  onChange,
  generate = false,
  showStrength = true,
  email = '',
  error,
  hint,
  required = true,
  disabled = false,
  autoComplete = 'new-password',
  placeholder,
  className,
  autoFocus,
}) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const strength = showStrength ? passwordStrength(value, { email }) : null;
  const hintText = hint === undefined ? `At least ${MIN_PASSWORD_LENGTH} characters.` : hint;
  const showHint = Boolean(hintText) || Boolean(strength?.label);
  const describedBy = [error && `${id}-error`, showHint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

  const handleGenerate = () => {
    onChange(generatePassword());
    // Show it: a generated password nobody can read cannot be passed on.
    setVisible(true);
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission (insecure context, blocked): the password is visible,
      // so selecting it by hand still works.
      setVisible(true);
    }
  };

  return (
    <div className={className}>
      <Label htmlFor={id} className="text-foreground">
        {label}{required ? ' *' : ''}
      </Label>
      <div className="relative mt-2">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="pr-12 surface border-border text-foreground"
          // Spaces and symbols are fine; stop the browser "correcting" a generated password.
          spellCheck={false}
          autoCapitalize="none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-destructive">{error}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {showHint && <div id={`${id}-hint`} className="min-w-0 text-xs text-muted-foreground">
          {hintText}
          {strength?.label && (
            <span aria-live="polite" className={cn('ml-2 font-medium', METER_TEXT[strength.score])}>
              {strength.label}
            </span>
          )}
        </div>}
        {generate && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleGenerate} disabled={disabled}>
              <Wand2 aria-hidden="true" />
              Generate
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={handleCopy} disabled={disabled}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {strength?.label && (
        <div className="mt-1.5 flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn('h-1 flex-1 rounded-full', i < strength.score ? METER[strength.score] : 'bg-muted')}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordField;
