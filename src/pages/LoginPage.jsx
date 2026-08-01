import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/components/ui/use-toast";
import { reportError, ERROR_TOAST_DURATION } from '@/lib/reportError';
import Brandmark from '@/components/shared/Brandmark';

// A single centred card rather than a marketing split. Nobody arrives here to
// be sold anything — MagnaFlow has no public signup, so every visitor is an
// existing user trying to get to work. The pitch column was just something to
// scroll past on a phone before reaching the only control that matters.

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const toastedRef = useRef(false);

  // Gate success toast on actual auth state change (onAuthStateChanged resolves async)
  useEffect(() => {
    if (isAuthenticated && user && !toastedRef.current) {
      toastedRef.current = true;
      toast({
        title: "Welcome back!",
        description: `Signed in as ${user.role}`,
      });
    }
  }, [isAuthenticated, user, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    toastedRef.current = false;
    try {
      const result = await login(email, password);
      if (!result.success) {
        // login() already maps the failure to a user-facing sentence.
        toast({
          title: "Login failed",
          description: result.error,
          variant: "destructive",
          duration: ERROR_TOAST_DURATION,
        });
      }
    } catch (error) {
      reportError(error, { title: "Login failed", fallback: "We couldn't sign you in. Please try again." });
    } finally {
      setLoading(false);
    }
  };

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
            Sign in to MagnaFlow
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your details to continue.
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-11"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-11 pr-12"
                  placeholder="Enter your password"
                  required
                />
                {/* Typing a password blind is the most common cause of a failed
                    sign-in, and this form has no "forgot password" escape. */}
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
            </div>

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Trouble signing in? Contact your organisation administrator.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
