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

  const newsletterForm = document.querySelector("[data-newsletter-form]");
  const newsletterStatus = document.querySelector("[data-newsletter-status]");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setNewsletterStatus = (message, state = "") => {
    newsletterStatus.textContent = message;
    newsletterStatus.dataset.state = state;
  };

  if (new URLSearchParams(window.location.search).get("subscription") === "confirmed") {
    setNewsletterStatus("Your subscription is confirmed. Welcome to Full Court Access.", "success");
  }

  newsletterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(newsletterForm).get("email")?.trim();
    const submitButton = newsletterForm.querySelector("button[type='submit']");

    if (!emailPattern.test(email || "")) {
      setNewsletterStatus("Enter a valid email address.", "error");
      newsletterForm.querySelector("input").focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending";
    setNewsletterStatus("", "");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Unable to subscribe.");

      newsletterForm.reset();
      setNewsletterStatus("Check your inbox to confirm your subscription.", "success");
    } catch (error) {
      setNewsletterStatus(error.message || "Unable to subscribe right now. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Subscribe";
    }
  });
})();
