import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, Eye, EyeOff, ShieldCheck, GitBranch, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { reportError, ERROR_TOAST_DURATION } from '@/lib/reportError';
import Brandmark from '@/components/shared/Brandmark';

const HIGHLIGHTS = [
  { icon: GitBranch, title: 'One flow, five roles', body: 'Org, department, project and staff views stay in step automatically.' },
  { icon: BarChart3, title: 'Progress you can see', body: 'Timelines and workload roll up without anyone chasing a status update.' },
  { icon: ShieldCheck, title: 'Scoped by design', body: 'People see their own organisation and nothing else.' },
];

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
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
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel. Hidden below lg — on a phone it would push the form,
          the only thing the user came for, below the fold. */}
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <Brandmark className="h-11 w-11 bg-primary-foreground/15 shadow-none" />
          <span className="text-xl font-bold tracking-tight">MagnaFlow</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[34px] font-bold leading-[1.15] tracking-tight">
            Every team&rsquo;s work, in one place.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/80">
            Role-based task management for organisations that outgrew a shared spreadsheet.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/15">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm text-primary-foreground/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} MagnaFlow
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center p-6 sm:p-10 lg:min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Brandmark className="h-11 w-11" />
            <span className="text-xl font-bold tracking-tight">MagnaFlow</span>
          </div>

          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome back. Enter your details to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  className="pl-11 pr-11"
                  placeholder="Enter your password"
                  required
                />
                {/* Typing a password blind is the most common cause of a failed
                    sign-in, and this form has no "forgot password" escape. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
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

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Trouble signing in? Contact your organisation administrator.
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default LoginPage;
