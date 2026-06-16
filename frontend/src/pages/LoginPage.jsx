import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
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
  const { setTokens, setUser } = useAuthStore();

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Register state (when ?token= present)
  const [mode, setMode] = useState(enrollToken ? 'register' : 'login');
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
      const { data: tokens } = await api.post('/auth/login/', { email, password });
      setTokens(tokens.access, tokens.refresh);
      const { data: user } = await api.get('/auth/me/', {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
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
                  />
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <p className="auth-note">Accounts are issued by your institution's administrators</p>
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
