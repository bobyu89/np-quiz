// ── 背景星空 ──
(() => {
  const c = document.getElementById('starfield');
  if (!c) return;
  const ctx = c.getContext('2d'), stars = [];
  function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  for (let i = 0; i < 80; i++) stars.push({ x: Math.random() * c.width, y: Math.random() * c.height, s: Math.random() * 2 + 0.5, sp: Math.random() * 0.3 + 0.05, o: Math.random() });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.o += (Math.random() - 0.5) * 0.04; s.o = Math.max(0.1, Math.min(0.9, s.o));
      s.y += s.sp; if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
      ctx.fillStyle = `rgba(10,90,255,${s.o})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.ceil(s.s), Math.ceil(s.s));
    });
    requestAnimationFrame(draw);
  }
  draw();
})();
