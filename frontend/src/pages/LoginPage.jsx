import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import AppearanceControl from '../components/AppearanceControl';
import { Icon } from '../components/icons';
import '../styles/auth.css';

export default function LoginPage() {
  usePageTitle('Log in');
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
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
          <h1>Welcome back</h1>
          <p className="sub">Sign in to pick up where you left off.</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>University email</label>
              <input
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
              <label>Password</label>
              <input
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
        </div>
      </main>
    </div>
  );
}
