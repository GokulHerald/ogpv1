import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as authApi from '../api/auth.api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.jsx';
import { Trophy, Gamepad2, Crown } from 'lucide-react';

const schema = z.object({
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
  email: z.string().email('Valid email required'),
  phoneNumber: z.string().min(1, 'Phone required'),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['player', 'organizer']),
  otp: z.string().min(4, 'OTP required').max(10),
});

const steps = ['Details', 'Email OTP', 'Role'];

export function RegisterPage() {
  const navigate = useNavigate();
  const { loginWithResponse } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'player', otp: '' },
  });

  const email = watch('email');
  const role = watch('role');

  const sendEmailOtp = async () => {
    const ok = await trigger(['firstName', 'lastName', 'email', 'phoneNumber', 'password', 'role', 'username']);
    if (!ok) return;

    try {
      setOtpSending(true);
      await authApi.startEmailRegistration({
        firstName: watch('firstName'),
        lastName: watch('lastName'),
        email: String(watch('email') || '').trim(),
        phoneNumber: String(watch('phoneNumber') || '').trim(),
        username: String(watch('username') || '').trim(),
        password: watch('password'),
        role: watch('role'),
      });
      toast.success('OTP sent to email');
      setStep(1);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OTP email');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyEmailOtp = async () => {
    const ok = await trigger(['otp']);
    if (!ok) return;
    try {
      setOtpVerifying(true);
      const res = await authApi.verifyEmailRegistration({
        email: String(email || '').trim(),
        otp: String(watch('otp') || '').trim(),
      });
      loginWithResponse(res);
      toast.success('Account verified');
      navigate('/tournaments', { replace: true });
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Email OTP verification failed');
    } finally {
      setOtpVerifying(false);
    }
  };

  const nextFromStep1 = async () => {
    const ok = await trigger(['username', 'password']);
    if (ok) setStep(2);
  };

  const onSubmit = async () => {
    // Final submit is OTP verification now. Keep form submit for enter-key support.
    if (step === 0) return sendEmailOtp();
    if (step === 1) return verifyEmailOtp();
    return null;
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-brand-bg px-8 py-16 shadow-glow-red">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 70% 30%, rgba(232,57,42,0.35), transparent 55%)',
          }}
        />
        <div className="noise-bg absolute inset-0 opacity-50" />
        <div className="relative z-10 mx-auto max-w-md text-center md:text-left">
          <div className="mb-8 flex items-center justify-center gap-2 md:justify-start">
            <Trophy className="h-12 w-12 text-brand-red" />
            <span className="font-display text-3xl font-black text-brand-light">OGP</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-brand-light">Join the arena</h2>
          <p className="mt-3 text-brand-muted">Verify OTP first, then complete your profile.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-brand-surface px-6 py-16">
        <div className="w-full max-w-md">
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-brand-light">Register</h1>
          <div className="mt-3 h-1 w-16 bg-brand-red" />

          <div className="mt-8 flex gap-2">
            {steps.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => i === 0 && setStep(0)}
                className={clsx(
                  'flex-1 rounded-full border px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition-all',
                  step === i
                    ? 'border-brand-red bg-brand-red/10 text-brand-light shadow-glow-red'
                    : 'border-brand-border text-brand-muted hover:border-brand-border/80'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm text-brand-muted">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-brand-orange hover:underline">
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {step === 0 ? (
              <>
                <Input label="First name" {...register('firstName')} error={errors.firstName?.message} />
                <Input label="Last name" {...register('lastName')} error={errors.lastName?.message} />
                <Input label="Email" {...register('email')} error={errors.email?.message} />
                <Input label="Phone number" {...register('phoneNumber')} error={errors.phoneNumber?.message} />
                <Input label="Username" {...register('username')} error={errors.username?.message} />
                <div className="space-y-2">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    error={errors.password?.message}
                  />
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-orange hover:underline"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'Hide password' : 'Show password'}
                  </button>
                </div>
                <p className="text-sm font-medium text-brand-light">Choose your role</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setValue('role', 'player', { shouldValidate: true })}
                    className={clsx(
                      'card-surface flex flex-col items-center gap-3 p-6 text-center transition-all',
                      role === 'player' ? 'shadow-glow-red ring-2 ring-brand-red' : 'hover:border-brand-border/80'
                    )}
                  >
                    <Gamepad2 className="h-10 w-10 text-brand-orange" />
                    <span className="font-display text-lg font-bold text-brand-light">Player</span>
                    <span className="text-xs text-brand-muted">Compete in tournaments</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('role', 'organizer', { shouldValidate: true })}
                    className={clsx(
                      'card-surface flex flex-col items-center gap-3 p-6 text-center transition-all',
                      role === 'organizer' ? 'shadow-glow-red ring-2 ring-brand-red' : 'hover:border-brand-border/80'
                    )}
                  >
                    <Crown className="h-10 w-10 text-brand-red" />
                    <span className="font-display text-lg font-bold text-brand-light">Organizer</span>
                    <span className="text-xs text-brand-muted">Host events & verify results</span>
                  </button>
                </div>
                {errors.role ? <p className="text-sm text-red-400">{errors.role.message}</p> : null}
                <input type="hidden" {...register('role')} />
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={otpSending || submitting}
                  onClick={sendEmailOtp}
                >
                  {otpSending ? <LoadingSpinner className="mx-auto !border-t-white" size="sm" /> : 'Send email OTP'}
                </Button>
              </>
            ) : step === 1 ? (
              <>
                <p className="text-sm text-brand-muted">
                  We sent a verification code to <span className="text-brand-light">{String(email || '').trim()}</span>.
                </p>
                <Input label="OTP code" {...register('otp')} error={errors.otp?.message} />
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="flex-1"
                    disabled={otpVerifying}
                    onClick={verifyEmailOtp}
                  >
                    {otpVerifying ? <LoadingSpinner className="mx-auto !border-t-white" size="sm" /> : 'Verify OTP'}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={otpSending}
                  onClick={sendEmailOtp}
                >
                  {otpSending ? 'Sending…' : 'Resend code'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-brand-muted">
                  Account verification is now done via email OTP. You can close this page.
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
