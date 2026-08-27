"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck,
  Activity,
  ClipboardCheck,
  Lock,
  Mail,
  Loader2,
  CheckCircle2,
  Factory,
} from "lucide-react";

// Simple inline email validator (RFC 5322 subset — sufficient for client UX).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignInForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [success, setSuccess] = useState(false);

  const emailError = emailTouched || submitAttempted
    ? !email.trim()
      ? t("emailRequired")
      : !EMAIL_RE.test(email.trim())
        ? t("emailInvalid")
        : null
    : null;

  const passwordError = passwordTouched || submitAttempted
    ? !password
      ? t("passwordRequired")
      : null
    : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    // Re-validate synchronously so failed submit also flags errors.
    if (!email.trim() || !EMAIL_RE.test(email.trim()) || !password) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setLoading(false);
        setError(t("invalidCredentials"));
      } else if (res?.ok) {
        setSuccess(true);
        // Brief success flash before redirect.
        setTimeout(() => {
          router.push(callbackUrl);
          router.refresh();
        }, 450);
      } else {
        setLoading(false);
        setError(t("invalidCredentials"));
      }
    } catch {
      setLoading(false);
      setError(t("invalidCredentials"));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* === Brand panel (desktop left, mobile header) === */}
      <aside
        className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground lg:w-1/2 lg:p-12"
        aria-label={t("securePlatform")}
      >
        {/* Decorative medical/industrial iconography */}
        <div className="pointer-events-none absolute inset-0 opacity-15" aria-hidden="true">
          <ShieldCheck className="absolute end-6 top-6 h-16 w-16" />
          <Activity className="absolute bottom-10 start-8 h-24 w-24" />
          <ClipboardCheck className="absolute end-12 bottom-16 h-20 w-20" />
          <Factory className="absolute start-16 top-1/3 h-16 w-16" />
        </div>

        {/* Logo + wordmark */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25 backdrop-blur-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-tight">Circum</span>
            <span className="text-[11px] uppercase tracking-wider text-primary-foreground/70">
              {t("securePlatform")}
            </span>
          </div>
        </div>

        {/* Center tagline (desktop only — hidden on mobile to keep header tight) */}
        <div className="relative mt-12 hidden flex-col gap-4 lg:flex">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            {t("welcomeBack")}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/80">
            {t("signInSubtitle")}
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-primary-foreground/85">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{tc("appTagline")}</span>
            </li>
            <li className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <span>{t("securePlatform")}</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="relative mt-12 text-[11px] text-primary-foreground/60">
          <p>
            {tc("demo")} · {tc("appTagline")}
          </p>
        </div>
      </aside>

      {/* === Form panel === */}
      <main className="flex flex-1 items-center justify-center bg-muted/30 p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="space-y-2 text-center sm:text-start">
            {/* Mobile-only compact logo (above the form) */}
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:mx-0 lg:hidden">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("signInTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("signInSubtitle")}
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                <span>{t("email")}</span>
                <span aria-hidden="true" className="text-destructive ms-0.5">*</span>
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  disabled={loading || success}
                  required
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "email-error" : undefined}
                  className="ps-9"
                />
              </div>
              {emailError ? (
                <p
                  id="email-error"
                  role="alert"
                  className="text-xs font-medium text-destructive animate-in fade-in-0 slide-in-from-top-0.5 duration-150"
                >
                  {emailError}
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                <span>{t("password")}</span>
                <span aria-hidden="true" className="text-destructive ms-0.5">*</span>
              </Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  disabled={loading || success}
                  required
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  className="ps-9"
                />
              </div>
              {passwordError ? (
                <p
                  id="password-error"
                  role="alert"
                  className="text-xs font-medium text-destructive animate-in fade-in-0 slide-in-from-top-0.5 duration-150"
                >
                  {passwordError}
                </p>
              ) : null}
            </div>

            {error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{t("signingIn")}</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t("signInButton")}</span>
                </>
              ) : (
                <span>{t("signInButton")}</span>
              )}
            </Button>
          </form>

          <div className="mt-4 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium">{t("demoCredentials")}</p>
            <ul className="mt-1.5 space-y-0.5 font-mono">
              <li>admin@circum.demo / CircumDemo2025!</li>
              <li>qmanager.ch@circum.demo / CircumDemo2025!</li>
              <li>operator.tn@circum.demo / CircumDemo2025!</li>
              <li>auditor.fr@circum.demo / CircumDemo2025!</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
