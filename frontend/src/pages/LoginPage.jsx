import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import AppearanceControl from '../components/AppearanceControl';
import { Icon } from '../components/icons';
import '../styles/auth.css';

export default function LoginPage() {
  usePageTitle('Log in');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const enrollToken = searchParams.get('token');
  const resetUid = searchParams.get('uid');
  const resetToken = searchParams.get('token');
  const isResetLink = !!(resetUid && resetToken);
  const { setTokens, setUser } = useAuthStore();

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [otp, setOtp] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLabel, setSsoLabel] = useState('SSO');

  // SSO: handle the redirect back from the IdP, and detect whether SSO is on.
  useEffect(() => {
    const ssoAccess = searchParams.get('sso_access');
    const ssoRefresh = searchParams.get('sso_refresh');
    const ssoErr = searchParams.get('sso_error');
    if (ssoAccess && ssoRefresh) {
      setTokens(ssoAccess, ssoRefresh);
      api.get('/auth/me/', { headers: { Authorization: `Bearer ${ssoAccess}` } })
        .then(({ data }) => { setUser(data); navigate('/dashboard'); })
        .catch(() => setError('Single sign-on failed. Please try again.'));
      return;
    }
    if (ssoErr) {
      setError(ssoErr === 'inactive'
        ? 'Your account is inactive — contact an administrator.'
        : 'Single sign-on failed. Please try again.');
    }
    api.get('/auth/oidc/status/')
      .then(({ data }) => { setSsoEnabled(data.enabled); if (data.label) setSsoLabel(data.label); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Password-reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  // Register state (when ?token= present, with no uid) / reset (uid+token present)
  const [mode, setMode] = useState(
    isResetLink ? 'reset' : (enrollToken ? 'register' : 'login'),
  );

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset/', { email: resetEmail });
      setResetSent(true);
    } catch {
      setResetSent(true); // never reveal whether the email exists
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm/', {
        uid: resetUid, token: resetToken, new_password: newPassword,
      });
      setResetDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }
  const [regFirst, setRegFirst] = useState('');
  const [regLast, setRegLast] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDone, setRegDone] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { email, password };
      if (mfaRequired) payload.otp = otp;
      const { data: tokens } = await api.post('/auth/login/', payload);
      setTokens(tokens.access, tokens.refresh);
      const { data: user } = await api.get('/auth/me/', {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.mfa_required) {
        setMfaRequired(true);
        setError('');
      } else {
        setError(data?.detail || (mfaRequired ? 'Invalid authentication code.' : 'Invalid credentials. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register/', {
        first_name: regFirst,
        last_name: regLast,
        email: regEmail,
        password: regPassword,
        enroll_token: enrollToken || undefined,
      });
      setRegDone(true);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.detail || data?.email?.[0] || data?.password?.[0] || 'Registration failed — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="ag" /><div className="glow" />
        <Link className="auth-brand" to="/"><span className="sb-mark">V</span><span className="sb-word">VenU</span></Link>
        <div>
          <h2>The whole campus, bookable.</h2>
          <p className="lede">Sign in to request spaces, track approvals and manage your bookings — all in one calm place.</p>
          <div className="auth-cards">
            <div className="ac"><div className="n">Browse</div><div className="l">Spaces</div></div>
            <div className="ac"><div className="n">Request</div><div className="l">Slots</div></div>
            <div className="ac"><div className="n">Track</div><div className="l">Approvals</div></div>
          </div>
        </div>
        <span className="auth-foot">© {new Date().getFullYear()} VenU · AroLabs</span>
      </aside>

      <main className="auth-main">
        <div className="auth-form reveal-up">
          <div className="topnav">
            <Link className="btn btn-ghost btn-sm" to="/"><Icon.ArrowLeft width={14} height={14} /> Home</Link>
            <AppearanceControl />
          </div>

          {mode === 'login' && (
            <>
              <h1>Welcome back</h1>
              <p className="sub">Sign in to pick up where you left off.</p>
              {ssoEnabled && !mfaRequired && (
                <>
                  <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={() => { window.location.href = `${API_BASE}/auth/oidc/login/`; }}>
                    Continue with {ssoLabel}
                  </button>
                  <div className="auth-or"><span>or sign in with email</span></div>
                </>
              )}
              <form onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="login-email">University email</label>
                  <input
                    id="login-email"
                    className="input"
                    type="email"
                    placeholder="you@institution.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    className="input"
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={mfaRequired}
                  />
                </div>
                {mfaRequired && (
                  <div className="field">
                    <label htmlFor="login-otp">Authentication code</label>
                    <input
                      id="login-otp"
                      className="input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code or backup code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      autoFocus
                    />
                    <span style={{ fontSize: '.8rem', color: 'var(--ink-45)', marginTop: '.3rem' }}>
                      Enter the code from your authenticator app.
                    </span>
                  </div>
                )}
                {error && <p className="auth-error">{error}</p>}
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                  {loading ? (mfaRequired ? 'Verifying…' : 'Signing in…') : (mfaRequired ? 'Verify' : 'Sign in')}
                </button>
              </form>
              <p className="auth-note" style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'inline', padding: 0, textDecoration: 'underline' }}
                  onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }}
                >
                  Forgot your password?
                </button>
              </p>
              <p className="auth-note">Accounts are issued by your institution's administrators</p>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <h1>Reset your password</h1>
              {resetSent ? (
                <>
                  <p className="sub">If <b>{resetEmail}</b> has an account, a reset link is on its way. Check your inbox.</p>
                  <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: '1rem' }} onClick={() => { setMode('login'); setError(''); }}>
                    Back to sign in
                  </button>
                </>
              ) : (
                <>
                  <p className="sub">Enter your university email and we'll send you a link to set a new password.</p>
                  <form onSubmit={handleForgot}>
                    <div className="field">
                      <label htmlFor="forgot-email">University email</label>
                      <input id="forgot-email" className="input" type="email" placeholder="you@uhas.edu.gh" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoFocus />
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                      {loading ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                  <p className="auth-note" style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ display: 'inline', padding: 0, textDecoration: 'underline' }} onClick={() => { setMode('login'); setError(''); }}>
                      Back to sign in
                    </button>
                  </p>
                </>
              )}
            </>
          )}

          {mode === 'reset' && (
            <>
              <h1>Choose a new password</h1>
              {resetDone ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div className="success-ring" style={{ margin: '0 auto 1.2rem' }}><Icon.Check /></div>
                  <h2>Password updated</h2>
                  <p className="sub" style={{ marginBottom: '1.5rem' }}>You can now sign in with your new password.</p>
                  <button className="btn btn-primary btn-block" onClick={() => { setMode('login'); setResetDone(false); setError(''); }}>
                    Go to sign in
                  </button>
                </div>
              ) : (
                <>
                  <p className="sub">Set a new password for your account.</p>
                  <form onSubmit={handleReset}>
                    <div className="field">
                      <label htmlFor="reset-password">New password</label>
                      <input id="reset-password" className="input" type="password" minLength={8} placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus />
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                      {loading ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {mode === 'register' && !regDone && (
            <>
              <h1>Create your account</h1>
              <p className="sub">You've been invited — fill in your details to get started.</p>
              <form onSubmit={handleRegister}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem', marginBottom: '.7rem' }}>
                  <div className="field">
                    <label htmlFor="reg-first">First name</label>
                    <input id="reg-first" className="input" value={regFirst} onChange={e => setRegFirst(e.target.value)} required autoFocus />
                  </div>
                  <div className="field">
                    <label htmlFor="reg-last">Last name</label>
                    <input id="reg-last" className="input" value={regLast} onChange={e => setRegLast(e.target.value)} required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="reg-email">Email</label>
                  <input id="reg-email" className="input" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="reg-password">Password</label>
                  <input id="reg-password" className="input" type="password" minLength={8} placeholder="At least 8 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
              <p className="auth-note" style={{ textAlign: 'center', marginTop: '1rem' }}>
                Already have an account?{' '}
                <button className="btn btn-ghost btn-sm" style={{ display: 'inline', padding: '0', textDecoration: 'underline' }} onClick={() => { setMode('login'); setError(''); }}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {mode === 'register' && regDone && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div className="success-ring" style={{ margin: '0 auto 1.2rem' }}><Icon.Check /></div>
              <h2>Account created!</h2>
              <p className="sub" style={{ marginBottom: '1.5rem' }}>You can now sign in with your new credentials.</p>
              <button className="btn btn-primary btn-block" onClick={() => { setMode('login'); setRegDone(false); setError(''); }}>
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
