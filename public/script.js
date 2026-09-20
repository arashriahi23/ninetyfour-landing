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
      const themes = {
        "chapter-01": "green",
        "chapter-02": "navy",
        "chapter-03": "burgundy",
        "chapter-04": "earth",
        "chapter-05": "dark"
      };
      masthead.dataset.theme = themes[current] || "green";
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

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const setupMessageForm = ({ formSelector, statusSelector, endpoint, buttonLabel, successMessage, buildPayload }) => {
    const form = document.querySelector(formSelector);
    const status = document.querySelector(statusSelector);
    if (!form || !status) return;

    let submitting = false;
    const emailInput = form.querySelector("input[name='email']");
    const submitButton = form.querySelector("button[type='submit']");
    const startedAt = form.querySelector("input[name='startedAt']");
    const setStatus = (message, state = "") => {
      status.textContent = message;
      status.dataset.state = state;
    };
    const resetTimer = () => { startedAt.value = String(Date.now()); };
    resetTimer();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = new FormData(form);
      const email = String(data.get("email") || "").trim();
      if (!emailPattern.test(email)) {
        setStatus("ENTER A VALID EMAIL ADDRESS.", "error");
        emailInput.setAttribute("aria-invalid", "true");
        emailInput.focus();
        return;
      }
      if (window.location.protocol === "file:") {
        setStatus("SOMETHING WENT WRONG. PLEASE TRY AGAIN.", "error");
        return;
      }

      submitting = true;
      emailInput.removeAttribute("aria-invalid");
      form.setAttribute("aria-busy", "true");
      submitButton.disabled = true;
      submitButton.textContent = "SENDING...";
      setStatus("");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(data, email))
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error("Submission failed");
        form.reset();
        resetTimer();
        setStatus(successMessage, "success");
      } catch {
        setStatus("SOMETHING WENT WRONG. PLEASE TRY AGAIN.", "error");
      } finally {
        submitting = false;
        form.removeAttribute("aria-busy");
        submitButton.disabled = false;
        submitButton.textContent = buttonLabel;
      }
    });
    emailInput.addEventListener("input", () => emailInput.removeAttribute("aria-invalid"));
  };

  setupMessageForm({
    formSelector: "[data-collaboration-form]",
    statusSelector: "[data-collaboration-form-status]",
    endpoint: "/api/collaboration",
    buttonLabel: "Send inquiry",
    successMessage: "MESSAGE RECEIVED. WE’LL BE IN TOUCH.",
    buildPayload: (data, email) => ({
      name: String(data.get("name") || "").trim(),
      email,
      type: String(data.get("type") || "").trim(),
      date: String(data.get("date") || "").trim(),
      location: String(data.get("location") || "").trim(),
      guests: String(data.get("guests") || "").trim(),
      details: String(data.get("details") || "").trim(),
      website: String(data.get("website") || "").trim(),
      startedAt: Number(data.get("startedAt"))
    })
  });

  setupMessageForm({
    formSelector: "[data-contact-form]",
    statusSelector: "[data-contact-form-status]",
    endpoint: "/api/contact",
    buttonLabel: "Send message",
    successMessage: "MESSAGE RECEIVED",
    buildPayload: (data, email) => ({
      name: String(data.get("name") || "").trim(),
      email,
      message: String(data.get("message") || "").trim(),
      website: String(data.get("website") || "").trim(),
      startedAt: Number(data.get("startedAt"))
    })
  });

  const newsletterForm = document.querySelector("[data-newsletter-form]");
  const newsletterStatus = document.querySelector("[data-newsletter-status]");
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
