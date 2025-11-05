// Simple, conventional horizontal scrolling for kiosk
document.addEventListener('DOMContentLoaded', function () {
  const container = document.querySelector('.scroll-container');
  if (!container) return;

  // Start at left
  container.scrollLeft = 0;

  // Wheel -> horizontal
  function onWheel(e) {
    if (Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      container.scrollLeft += e.deltaY * 1.2;
    }
  }
  container.addEventListener('wheel', onWheel, { passive: false });

  // Touch drag
  let touchStartX = 0;
  container.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  container.addEventListener('touchmove', function (e) {
    if (!e.touches || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    if (Math.abs(dx) > 0) {
      e.preventDefault();
      container.scrollLeft -= dx;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: false });

  // Keyboard navigation
  document.addEventListener('keydown', function (e) {
    const step = Math.round(window.innerWidth * 0.9);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      container.scrollBy({ left: step, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      container.scrollBy({ left: -step, behavior: 'smooth' });
    }
  });
});
