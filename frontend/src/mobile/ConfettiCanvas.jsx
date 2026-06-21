import { useEffect, useRef } from 'react';

/*
 * Pure-canvas confetti burst — ported from mobile.html launchConfetti().
 * 90 particles, gravity easing, ~90 frames. Fires once on mount.
 * Respects prefers-reduced-motion (skips the animation).
 */
const COLORS = ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#ffffff'];

export default function ConfettiCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const particles = Array.from({ length: 90 }, () => ({
      x: W / 2,
      y: H * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 12 + 4),
      col: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 8,
      w: Math.random() * 10 + 4,
      h: Math.random() * 5 + 3,
    }));

    let frame = 0;
    let raf;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38;
        p.rot += p.rv;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < 90) {
        raf = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }
    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="m-confetti" aria-hidden="true" />;
}
