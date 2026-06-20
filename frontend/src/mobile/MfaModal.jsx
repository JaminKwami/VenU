import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import api from '../api/axios';
import { Icon } from '../components/icons';

/*
 * Two-factor (TOTP) management sheet.
 *  - If disabled: setup → scan QR / enter code → enable → show backup codes.
 *  - If enabled: confirm password → disable.
 */
export default function MfaModal({ enabled, onClose, onChanged, toast }) {
  const [step, setStep] = useState(enabled ? 'disable' : 'intro');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (step === 'scan' && otpauth && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, otpauth, { width: 200, margin: 1 }).catch(() => {});
    }
  }, [step, otpauth]);

  async function beginSetup() {
    setBusy(true); setErr('');
    try {
      const { data } = await api.post('/auth/mfa/setup/');
      setSecret(data.secret);
      setOtpauth(data.otpauth_uri);
      setStep('scan');
    } catch {
      setErr('Could not start setup. Try again.');
    } finally { setBusy(false); }
  }

  async function confirmEnable(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { data } = await api.post('/auth/mfa/enable/', { code });
      setCodes(data.backup_codes || []);
      setStep('codes');
    } catch (e2) {
      setErr(e2.response?.data?.detail || 'That code is incorrect.');
    } finally { setBusy(false); }
  }

  async function confirmDisable(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/auth/mfa/disable/', { password });
      toast?.('Two-factor turned off');
      onChanged?.(false);
      onClose();
    } catch (e2) {
      setErr(e2.response?.data?.detail || 'Password incorrect.');
    } finally { setBusy(false); }
  }

  function finishEnable() {
    toast?.('Two-factor is on');
    onChanged?.(true);
    onClose();
  }

  return (
    <div className="m-sheet-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-sheet">
        {step === 'intro' && (
          <>
            <h3 className="m-sheet-title">Set up two-factor auth</h3>
            <p className="m-sheet-msg">Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, Microsoft Authenticator).</p>
            {err && <p className="auth-error">{err}</p>}
            <div className="m-sheet-actions">
              <button className="btn btn-ghost btn-block" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={beginSetup}>{busy ? '…' : 'Begin'}</button>
            </div>
          </>
        )}

        {step === 'scan' && (
          <form onSubmit={confirmEnable}>
            <h3 className="m-sheet-title">Scan & confirm</h3>
            <p className="m-sheet-msg">Scan this in your authenticator app, then enter the 6-digit code it shows.</p>
            <div style={{ display: 'grid', placeItems: 'center', margin: '12px 0' }}>
              <canvas ref={canvasRef} />
            </div>
            <p style={{ fontSize: '.72rem', color: 'var(--ink-45)', textAlign: 'center', wordBreak: 'break-all', marginBottom: 12 }}>
              Can’t scan? Key: <b>{secret}</b>
            </p>
            <div className="field">
              <label htmlFor="mfa-code">6-digit code</label>
              <input id="mfa-code" className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            </div>
            {err && <p className="auth-error">{err}</p>}
            <div className="m-sheet-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? '…' : 'Turn on'}</button>
            </div>
          </form>
        )}

        {step === 'codes' && (
          <>
            <h3 className="m-sheet-title">Save your backup codes</h3>
            <p className="m-sheet-msg">Keep these somewhere safe. Each works once if you lose your authenticator.</p>
            <div className="m-backup-codes">
              {codes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <div className="m-sheet-actions">
              <button className="btn btn-ghost btn-block" onClick={() => { navigator.clipboard?.writeText(codes.join('\n')); toast?.('Copied'); }}>Copy</button>
              <button className="btn btn-primary btn-block" onClick={finishEnable}>Done</button>
            </div>
          </>
        )}

        {step === 'disable' && (
          <form onSubmit={confirmDisable}>
            <h3 className="m-sheet-title">Turn off two-factor?</h3>
            <p className="m-sheet-msg">Enter your password to disable 2FA. Your account will be less protected.</p>
            <div className="field">
              <label htmlFor="mfa-pw">Password</label>
              <input id="mfa-pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            </div>
            {err && <p className="auth-error">{err}</p>}
            <div className="m-sheet-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-danger btn-block" disabled={busy}>{busy ? '…' : 'Turn off'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
