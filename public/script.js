(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const primaryImage = document.querySelector(".horsemen-primary");
  const echoImage = document.querySelector(".horsemen-echo");
  const chapters = [...document.querySelectorAll("[data-chapter]")];
  const links = [...document.querySelectorAll(".chapter-link")];
  let scrollY = window.scrollY;
  let rafId;
  const updateArtwork = (time) => {
    if (!reducedMotion.matches) {
      const idleX = Math.sin(time * .00012) * 1.25;
      const idleY = Math.cos(time * .00016) * .9;
      const influence = Math.min(scrollY / window.innerHeight, 1) * 2.7;
      const transform = `translate3d(calc(-50% + ${idleX - influence}%), calc(-50% + ${idleY - influence * .35}%), 0) scale(${1.07 + influence * .008})`;
      primaryImage.style.transform = transform;
      echoImage.style.transform = transform.replace("1.07", "1.08");
    }
    rafId = requestAnimationFrame(updateArtwork);
  };
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) links.forEach((link) => link.classList.toggle("is-active", link.dataset.chapter === entry.target.id)); }), { threshold:.56 });
  chapters.forEach((chapter) => observer.observe(chapter));
  window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive:true });
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) cancelAnimationFrame(rafId); else rafId = requestAnimationFrame(updateArtwork); });
  if (!reducedMotion.matches) rafId = requestAnimationFrame(updateArtwork);
})();
