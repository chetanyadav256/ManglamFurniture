import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Brand from '../../components/Brand';
import usePageTitle from '../../hooks/usePageTitle';
import { BusyLabel, Field, FormAlert } from '../components/AdminUI';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLogin() {
  usePageTitle('Admin login');
  const { login, passwordChanged } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setMessage('');
    const next = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`login-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      setPassword('');
      navigate('/admin/dashboard', { replace: true });
    } catch (error) {
      setPassword('');
      if (error.status === 401) setMessage('Invalid email or password.');
      else if (error.status === 403)
        setMessage('This account is not authorized to access the admin dashboard.');
      else setMessage(error.message || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh bg-cream lg:grid-cols-2">
      <section className="relative isolate hidden flex-col justify-between overflow-hidden bg-walnut p-12 text-cream lg:flex xl:p-16">
        <img
          src="/images/interior.webp"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-walnut/75" />
        <Brand light />
        <div className="max-w-lg py-16">
          <p className="eyebrow mb-5 text-[#e2bc9c]">Behind every beautiful space</p>
          <h2 className="font-display text-6xl leading-[1.08] xl:text-7xl">
            A thoughtfully
            <br />
            managed <span className="italic">collection.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-8 text-cream/85">
            Your workspace for the pieces, details, and categories that bring Manglam Furniture to
            life.
          </p>
        </div>
        <p className="text-xs text-cream/70">Manglam Furniture · Catalog studio</p>
      </section>
      <section className="flex flex-col justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <Brand />
          </div>
          <Link to="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-xs text-bark">
            <ArrowLeft size={15} />
            Back to website
          </Link>
          <span className="mb-5 flex size-12 items-center justify-center rounded-xl border border-sand bg-white text-walnut">
            <LockKeyhole size={22} strokeWidth={1.5} />
          </span>
          <p className="eyebrow mb-3 text-bark">Manglam administration</p>
          <h1 className="font-display text-4xl text-walnut sm:text-5xl">Welcome back.</h1>
          <p className="mb-7 mt-3 text-sm leading-7 text-bark">
            Sign in securely to manage the Manglam Furniture catalog.
          </p>
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-sand bg-white p-4 text-xs leading-6 text-bark">
            <LockKeyhole size={18} className="mt-1 shrink-0 text-walnut" />
            <p>
              Admin access is restricted to authorized accounts. No public registration is
              available.
            </p>
          </div>
          <form noValidate onSubmit={submit} className="space-y-5" aria-busy={busy}>
            <FormAlert variant="notice">{passwordChanged && 'Password changed. Please sign in again with your new password.'}</FormAlert>
            <FormAlert>{message}</FormAlert>
            <Field label="Admin email" id="login-email" error={errors.email} required>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                className="field rounded-md"
                placeholder="Your admin email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
            </Field>
            <Field label="Password" id="login-password" error={errors.password} required>
              <div className="relative">
                <input
                  id="login-password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field rounded-md pr-12"
                  placeholder="Your password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  disabled={busy}
                  className="absolute right-1 top-0.5 flex size-11 items-center justify-center text-bark"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <button type="submit" disabled={busy} className="btn-primary w-full rounded-md">
              <BusyLabel busy={busy} busyText="Signing in…">
                Login <ArrowRight size={16} />
              </BusyLabel>
            </button>
          </form>
          <div className="mt-7 border-t border-sand pt-6">
            <Link to="/" className="btn-outline w-full rounded-md">
              Visit the public website
              <ArrowRight size={16} />
            </Link>
            <p className="mt-3 text-center text-[11px] leading-6 text-bark">
              Secure admin access · No public registration
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
