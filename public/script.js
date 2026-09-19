(() => {
  const chapters = [...document.querySelectorAll("section[data-chapter]")];
  const links = [...document.querySelectorAll("[data-chapter-link]")];
  const masthead = document.querySelector(".masthead");
  const mobileMenu = document.querySelector(".mobile-menu");
  let framePending = false;

  const updateActiveChapter = () => {
    framePending = false;
    // A reading line also works for chapters taller than the viewport.
    const readingLine = masthead.offsetHeight + window.innerHeight * .2;
    let current = chapters[0]?.id;
    chapters.forEach((chapter) => {
      if (chapter.getBoundingClientRect().top <= readingLine) current = chapter.id;
    });
    links.forEach((link) => {
      const active = link.dataset.chapterLink === current;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    if (masthead?.dataset) {
      const themes = { "chapter-03": "dark", "chapter-04": "rose", "chapter-05": "dark" };
      masthead.dataset.theme = themes[current] || "light";
    }
  };
  const queueChapterUpdate = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(updateActiveChapter);
  };
  window.addEventListener("scroll", queueChapterUpdate, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) mobileMenu.open = false;
    queueChapterUpdate();
  });
  window.addEventListener("load", updateActiveChapter);
  updateActiveChapter();

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href^='#']");
    if (anchor && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      mobileMenu.open = false;
      document.querySelector(anchor.getAttribute("href"))?.focus({ preventScroll: true });
    } else if (!mobileMenu.contains(event.target)) mobileMenu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileMenu.open) {
      mobileMenu.open = false;
      mobileMenu.querySelector("summary").focus();
    }
  });
  document.addEventListener("focusin", (event) => {
    if (!mobileMenu.contains(event.target)) mobileMenu.open = false;
  });

  const collaborationForm = document.querySelector("[data-collaboration-form]");
  collaborationForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!collaborationForm.checkValidity()) {
      collaborationForm.reportValidity();
      return;
    }
    const data = new FormData(collaborationForm);
    const lines = [
      ["Name", data.get("name")],
      ["Email", data.get("email")],
      ["Type", data.get("type")],
      ["Preferred date", data.get("date")],
      ["Location", data.get("location")],
      ["Approximate guest count", data.get("guests")],
      ["Additional details", data.get("details")]
    ].filter(([, value]) => String(value || "").trim());
    const body = lines.map(([label, value]) => `${label}: ${String(value).trim()}`).join("\n");
    window.location.href = `mailto:Admin@theninety4.com?subject=${encodeURIComponent("Ninety Four collaboration inquiry")}&body=${encodeURIComponent(body)}`;
  });

  const newsletterForm = document.querySelector("[data-newsletter-form]");
  const newsletterStatus = document.querySelector("[data-newsletter-status]");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let submitting = false;
  const setNewsletterStatus = (message, state = "") => {
    if (!newsletterStatus) return;
    newsletterStatus.textContent = message;
    newsletterStatus.dataset.state = state;
  };
  if (new URLSearchParams(window.location.search).get("subscription") === "confirmed") {
    setNewsletterStatus("Your subscription is confirmed. Welcome to Full Court Access.", "success");
  }
  newsletterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    const email = new FormData(newsletterForm).get("email")?.trim();
    const submitButton = newsletterForm.querySelector("button[type='submit']");
    const emailInput = newsletterForm.querySelector("input[name='email']");
    if (!emailPattern.test(email || "")) {
      setNewsletterStatus("Enter a valid email address.", "error");
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      return;
    }
    if (window.location.protocol === "file:") {
      setNewsletterStatus("Signup is available on the hosted website, not this local file preview.", "error");
      return;
    }
    submitting = true;
    emailInput.removeAttribute("aria-invalid");
    newsletterForm.setAttribute("aria-busy", "true");
    submitButton.disabled = true;
    submitButton.textContent = "Sending";
    setNewsletterStatus("");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to subscribe right now. Please try again.");
      newsletterForm.reset();
      setNewsletterStatus("Check your inbox to confirm your subscription.", "success");
    } catch (error) {
      const message = error instanceof TypeError ? "Unable to connect. Please try again." : error.message;
      setNewsletterStatus(message || "Unable to subscribe right now. Please try again.", "error");
    } finally {
      submitting = false;
      newsletterForm.removeAttribute("aria-busy");
      submitButton.disabled = false;
      submitButton.textContent = "Join";
    }
  });
  newsletterForm?.querySelector("input[name='email']")?.addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
  });
})();
