/* Progressive enhancements only: the page and all guide/image links work without JS. */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");

  const appearance = document.getElementById("appearance");
  const allowedThemes = new Set(["light", "dark", "system"]);
  let preference = "system";
  try {
    const saved = localStorage.getItem("flux-site-appearance");
    if (allowedThemes.has(saved)) preference = saved;
  } catch {
    /* Storage can be unavailable in privacy modes. */
  }
  function applyAppearance(value) {
    if (value === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", value);
    if (appearance) appearance.value = value;
  }
  applyAppearance(preference);
  appearance?.addEventListener("change", () => {
    const next = allowedThemes.has(appearance.value)
      ? appearance.value
      : "system";
    applyAppearance(next);
    try {
      localStorage.setItem("flux-site-appearance", next);
    } catch {
      /* Optional persistence. */
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "flux-site-appearance")
      applyAppearance(
        allowedThemes.has(event.newValue) ? event.newValue : "system",
      );
  });

  const menu = document.querySelector(".menu-toggle");
  const navigation = document.getElementById("main-navigation");
  function closeMenu(restoreFocus = false) {
    if (!menu || !navigation) return;
    menu.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    if (restoreFocus) menu.focus();
  }
  menu?.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    navigation?.classList.toggle("is-open", open);
  });
  navigation
    ?.querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menu?.getAttribute("aria-expanded") === "true"
    )
      closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (
      menu?.getAttribute("aria-expanded") === "true" &&
      !event.target.closest(".site-header")
    )
      closeMenu();
  });
  window
    .matchMedia("(min-width: 801px)")
    .addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });

  const dialog = document.getElementById("media-dialog");
  const largeImage = document.getElementById("media-dialog-image");
  const imageCaption = document.getElementById("media-dialog-caption");
  let imageOpener = null;
  if (dialog && typeof dialog.showModal === "function") {
    document.querySelectorAll("[data-enlarge]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        const image = link.querySelector("img");
        imageOpener = link;
        largeImage.src = link.href;
        largeImage.alt = image?.alt || "";
        imageCaption.textContent = link.dataset.caption || image?.alt || "";
        dialog.showModal();
        root.classList.add("dialog-open");
        dialog.querySelector(".dialog-close").focus();
      });
    });
    dialog
      .querySelector(".dialog-close")
      ?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    });
    dialog.addEventListener("close", () => {
      root.classList.remove("dialog-open");
      imageOpener?.focus({ preventScroll: true });
      largeImage.removeAttribute("src");
    });
  }

  const demo = document.getElementById("slide-demo");
  const launch = demo?.querySelector("[data-demo-start]");
  let demoFrame = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function notifyDemo(type, detail = {}) {
    if (!demoFrame?.contentWindow) return;
    demoFrame.contentWindow.postMessage(
      {
        source: "flux-website",
        type: type === "pause" ? "flux-demo-pause" : type,
        ...detail,
      },
      window.location.origin,
    );
  }
  // The native control bar can wrap on narrow screens or with larger text.
  window.addEventListener("message", (event) => {
    if (
      !demoFrame ||
      event.source !== demoFrame.contentWindow ||
      event.origin !== window.location.origin ||
      event.data?.type !== "flux-demo-resize"
    ) return;
    const height = event.data.height;
    if (!Number.isFinite(height) || height <= 0 || height > 3000) return;
    demo.style.aspectRatio = "auto";
    demo.style.paddingBottom = "0";
    demo.style.height = `${Math.ceil(height)}px`;
  });
  launch?.addEventListener("click", () => {
    if (demoFrame) return;
    demoFrame = document.createElement("iframe");
    demoFrame.src = demo.dataset.demoSrc;
    demoFrame.title = "Interactive Flux slides: neuronal populations";
    demoFrame.setAttribute("allow", "fullscreen");
    demoFrame.setAttribute("loading", "eager");
    demoFrame.addEventListener(
      "load",
      () => {
        notifyDemo("motion-preference", {
          reducedMotion: reducedMotion.matches,
        });
        // An intentional launch may enter the player. Loading never occurs on page arrival.
        demoFrame.focus({ preventScroll: true });
      },
      { once: true },
    );
    demo.replaceChildren(demoFrame);
  });
  reducedMotion.addEventListener("change", () =>
    notifyDemo("motion-preference", { reducedMotion: reducedMotion.matches }),
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) notifyDemo("pause");
  });
  if (demo && "IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) notifyDemo("pause");
      },
      { threshold: 0 },
    ).observe(demo);
  }
})();
