import { useEffect, useRef, useState } from 'react';
import { useAppearanceStore, ACCENTS } from '../store/appearanceStore';
import { Icon } from './icons';

/* Sun icon → popover with Theme / Accent / Motion controls. */
export default function AppearanceControl() {
  const { theme, accent, motion, setAppearance } = useAppearanceStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  return (
    <div className="pos-rel" ref={rootRef}>
      <button className="icon-btn" aria-label="Appearance" title="Appearance" onClick={() => setOpen(o => !o)}>
        <Icon.Sun />
      </button>
      <div className={`appear-pop${open ? ' open' : ''}`}>
        <div className="appear-row">
          <span className="label">Theme</span>
          <div className="seg">
            {['light', 'dark'].map(v => (
              <button key={v} className={theme === v ? 'on' : ''} onClick={() => setAppearance('theme', v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="appear-row">
          <span className="label">Accent</span>
          <div className="swatches">
            {ACCENTS.map(a => (
              <button
                key={a.id}
                className={`swatch${accent === a.id ? ' on' : ''}`}
                style={{ background: a.color }}
                aria-label={a.id}
                onClick={() => setAppearance('accent', a.id)}
              />
            ))}
          </div>
        </div>
        <div className="appear-row">
          <span className="label">Motion</span>
          <div className="seg">
            {['cinematic', 'calm'].map(v => (
              <button key={v} className={motion === v ? 'on' : ''} onClick={() => setAppearance('motion', v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
