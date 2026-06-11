import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="page-content fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', lineHeight: 1 }}>404</h1>
      <p style={{ color: 'var(--ink-2)' }}>That page doesn't exist.</p>
      <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
        Back to dashboard
      </Link>
    </div>
  );
}
