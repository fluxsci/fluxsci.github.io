/* Progressive enhancements only: the page and all guide/image links work without JS. */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // A visitor chooses the pace. Each view is a photograph of the actual app,
  // loaded before it replaces the current view; rapid choices cannot race.
  const preview = document.querySelector("[data-workspace-preview]");
  if (preview) {
    const choices = preview.querySelector(".workspace-choices");
    const buttons = [...choices.querySelectorAll("button")];
    const link = preview.querySelector(".hero-image");
    const image = link.querySelector("img");
    const caption = preview.querySelector("[data-workspace-caption]");
    const guide = preview.querySelector("[data-workspace-guide]");
    const prompt = preview.querySelector(".workspace-prompt");
    const workspaces = {
      paper: ["Paper", "Write with your figures, citations, and working notes in reach.", "Flux Paper workspace with the demonstration manuscript, project documents, and a connected scientific figure."],
      figure: ["Figure", "Compose the whole figure. Refine every individual part.", "Flux Figure workspace with the authored materials composition and its layers."],
      slides: ["Slides", "Give the same figures a timeline. Build the explanation step by step.", "Flux Slides workspace with the new website showcase deck and its editable animation steps."],
      library: ["Library", "A lasting collection of references, ready for every project.", "Flux Library workspace with the illustrative study collection, paper metadata, and organization controls."],
      reader: ["Reader", "Read closely. Keep your notes connected to the evidence.", "Flux Reader workspace displaying the original Patterns across scales manuscript and its reading tools."],
    };
    const loads = new Map();
    let request = 0;
    let selected = "figure";
    const preload = (name) => {
      if (!loads.has(name)) {
        const next = new Image();
        next.src = `assets/media/${name === "figure" ? "figure-materials" : name}.webp`;
        const loading = next.decode().then(() => next).catch(error => {
          loads.delete(name);
          throw error;
        });
        loads.set(name, loading);
      }
      return loads.get(name);
    };
    async function show(name) {
      const token = ++request;
      preview.setAttribute("aria-busy", "true");
      prompt.textContent = `Loading ${workspaces[name][0]}…`;
      try {
        const next = await preload(name);
        if (token !== request) return;
        const [title, description, alt] = workspaces[name];
        if (selected !== name && !reducedMotion.matches) {
          image.getAnimations().forEach(animation => animation.cancel());
          image.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
        }
        image.src = next.src;
        image.alt = alt;
        link.href = next.src;
        link.dataset.caption = `${title} in Flux. ${description}`;
        link.setAttribute("aria-label", `Enlarge the Flux ${title} workspace`);
        caption.textContent = description;
        guide.href = `/docs/${name}.html`;
        guide.replaceChildren(document.createTextNode(`Explore ${title}`));
        const arrow = document.createElement("span");
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↓";
        guide.append(arrow);
        for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.workspace === name));
        selected = name;
      } catch {
        if (token === request) caption.textContent = "This preview could not load. Open the workspace guide below.";
      } finally {
        if (token === request) {
          preview.removeAttribute("aria-busy");
          prompt.textContent = "Explore the workspace";
        }
      }
    }
    for (const [index, button] of buttons.entries()) {
      const name = button.dataset.workspace;
      button.addEventListener("click", () => show(name));
      for (const event of ["pointerenter", "focus"]) button.addEventListener(event, () => preload(name).catch(() => {}));
      button.addEventListener("keydown", event => {
        const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: buttons.length - 1 - index };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        const next = buttons[(index + offsets[event.key] + buttons.length) % buttons.length];
        next.focus();
        show(next.dataset.workspace);
      });
    }
    choices.hidden = false;
    preview.classList.add("has-workspace-choices");
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) image.getAnimations().forEach(animation => animation.cancel());
    });
  }

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

  // Sections settle into place as they scroll into view. Everything is visible
  // without JS or with reduced motion; here we only add the class the CSS
  // transition waits for, and content already on screen is never held back.
  const reveals = [...document.querySelectorAll("[data-reveal]")];
  if (reveals.length) {
    if ("IntersectionObserver" in window && !reducedMotion.matches) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
      );
      reveals.forEach((element) => observer.observe(element));
    } else reveals.forEach((element) => element.classList.add("is-in"));
  }

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
