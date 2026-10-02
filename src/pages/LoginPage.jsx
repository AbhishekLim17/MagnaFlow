import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, Eye, EyeOff, Moon, Sun, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { resetUserPassword } from "@/services/userService";
import { toUserMessage } from "@/lib/errorMessages";
import { isValidEmail } from "@/utils/validation";
import { usePageTitle } from "@/lib/usePageTitle";
import Brandmark from '@/components/shared/Brandmark';

// A single centred card rather than a marketing split. Nobody arrives here to
// be sold anything - MagnaFlow has no public signup, so every visitor is an
// existing user trying to get to work.

// After sending a reset link, the button stays off for a while so it cannot be used
// to spam someone's inbox.
const RESET_COOLDOWN_SECONDS = 30;

const FieldError = ({ id, children }) => (
  <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {children}
  </p>
);

const LoginPage = () => {
  usePageTitle("Sign in");

  const [mode, setMode] = useState("signin"); // signin | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({}); // { email, password, form }
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { login, notice } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  // The field is disabled while signing in, so focus can only go back once it is enabled.
  const refocusPassword = useRef(false);

  useEffect(() => {
    if (!loading && refocusPassword.current) {
      refocusPassword.current = false;
      passwordRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const validateEmail = (value) => {
    if (!value.trim()) return "Enter your email address.";
    if (!isValidEmail(value.trim())) return "That doesn't look like an email address.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Say what is wrong next to the field, and put the cursor there. (This used to be
    // a "Login failed" toast reading "Email and password are required".)
    const next = {};
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (next.email) { emailRef.current?.focus(); return; }
    if (next.password) { passwordRef.current?.focus(); return; }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        // login() already maps the failure to a sentence a person can act on. It stays
        // on screen (a toast vanished before it could be read), the wrong password is
        // cleared, and the cursor goes back to where they have to retype.
        setErrors({ form: result.error });
        setPassword("");
        refocusPassword.current = true;
      }
    } catch (error) {
      setErrors({ form: toUserMessage(error, "We couldn't sign you in. Please try again.") });
      refocusPassword.current = true;
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      emailRef.current?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await resetUserPassword(email.trim());
    } catch (error) {
      // Whether an account exists must not be revealed by this form, so "no such user"
      // reads exactly like success. Anything else (offline, throttled) is reported.
      const code = error?.code;
      if (code !== "auth/user-not-found") {
        if (code === "auth/invalid-email") {
          setErrors({ email: "That doesn't look like an email address." });
        } else {
          setErrors({ form: toUserMessage(error, "We couldn't send the link. Please try again.") });
        }
        setLoading(false);
        return;
      }
    }
    setResetSent(true);
    setCooldown(RESET_COOLDOWN_SECONDS);
    setLoading(false);
  };

  const openReset = () => {
    setMode("reset");
    setErrors({});
    setResetSent(false);
    setTimeout(() => emailRef.current?.focus(), 0);
  };

  const backToSignIn = () => {
    setMode("signin");
    setErrors({});
    setResetSent(false);
    setTimeout(() => emailRef.current?.focus(), 0);
  };

  const isReset = mode === "reset";

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6 py-12">
      {/* Two soft brand washes. Purely atmospheric, so they are hidden from
          assistive tech and sit behind everything. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-32 h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-3xl"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="absolute right-4 top-4 sm:right-6 sm:top-6"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Brandmark className="h-14 w-14" />
          <h1 className="mt-5 text-[26px] font-bold leading-tight tracking-tight">
            {isReset ? "Reset your password" : "Sign in to MagnaFlow"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isReset
              ? "Enter your email and we'll send you a link to choose a new one."
              : "Enter your details to continue."}
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          {/* Why you are here, when you did not sign yourself out. */}
          {notice && !isReset && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-foreground"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {isReset && resetSent ? (
            <div className="space-y-5 text-center" role="status">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
              <div>
                <p className="font-semibold">Check your inbox</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, we've
                  sent a link to reset its password. It can take a minute to arrive; check spam too.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" disabled={cooldown > 0 || loading} onClick={handleReset}>
                  {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
                </Button>
                <Button type="button" variant="ghost" onClick={backToSignIn}>
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={isReset ? handleReset : handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                    disabled={loading}
                    className="pl-11"
                    placeholder="you@company.com"
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
              </div>

              {!isReset && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={openReset}
                      className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="password"
                      ref={passwordRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                      disabled={loading}
                      className="pl-11 pr-12"
                      placeholder="Enter your password"
                      aria-invalid={errors.password || errors.form ? true : undefined}
                      aria-describedby={errors.password ? "password-error" : errors.form ? "form-error" : undefined}
                    />
                    {/* Typing a password blind is the most common cause of a failed sign-in. */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <FieldError id="password-error">{errors.password}</FieldError>}
                </div>
              )}

              {errors.form && <FieldError id="form-error">{errors.form}</FieldError>}

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                      aria-hidden="true"
                    />
                    {isReset ? "Sending…" : "Signing in…"}
                  </>
                ) : isReset ? (
                  "Send reset link"
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>

              {isReset && (
                <Button type="button" variant="ghost" className="w-full" onClick={backToSignIn}>
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Button>
              )}
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Trouble signing in? Contact your organisation administrator.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
