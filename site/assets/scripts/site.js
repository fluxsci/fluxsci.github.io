/* Progressive enhancements only: the page and all guide/image links work without JS. */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Flux's own mode pill, enlarged. It tours the five workspaces on its own until the
  // visitor picks one; from then on the visitor chooses the pace. Each view is a photograph
  // of the actual app, loaded before it replaces the current view; rapid choices cannot race.
  const preview = document.querySelector("[data-workspace-preview]");
  if (preview) {
    const choices = preview.querySelector(".workspace-choices");
    const pill = choices.querySelector("[role=tablist]");
    const buttons = [...pill.querySelectorAll("[role=tab]")];
    const link = preview.querySelector(".hero-image");
    const image = link.querySelector("img");
    const caption = preview.querySelector("[data-workspace-caption]");
    const guide = preview.querySelector("[data-workspace-guide]");
    const prompt = preview.querySelector(".workspace-prompt");
    const workspaces = {
      paper: ["Paper", "Write with your figures, citations, and working notes in reach.", "Flux Paper workspace with the demonstration manuscript, project documents, and a connected scientific figure."],
      figure: ["Figure", "Compose the whole figure. Refine every individual part.", "Flux Figure workspace with the authored materials composition and its layers."],
      slides: ["Slides", "Give the same figures a timeline. Build the explanation step by step.", "Flux Slides with the Plots in Motion earthquake map and its editable animation steps."],
      library: ["Library", "A lasting collection of references, ready for every project.", "Flux Library workspace showing a structural biology bibliography, the selected paper’s metadata and collection controls."],
      reader: ["Reader", "Read closely. Keep your notes connected to the evidence.", "Flux Reader with the AlphaFold paper, a highlighted passage and the associated note."],
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
        arrow.textContent = "→";
        guide.append(arrow);
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
    // The pill answers at once (as in the app); the image follows when it has loaded.
    const mark = (name) => {
      buttons.forEach((button, index) => {
        const on = button.dataset.workspace === name;
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
        if (on) pill.style.setProperty("--mi", index);
      });
    };
    const choose = (name) => {
      mark(name);
      show(name);
    };

    // The tour: DWELL ms per workspace, only while the figure is on screen, the tab is
    // visible and the visitor is not pointing at or focused in the pill. Any choice ends it.
    const DWELL = 4500;
    let touring = !reducedMotion.matches;
    let onScreen = false;
    let held = false;
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = 0;
      if (!touring || !onScreen || held || document.hidden) return;
      timer = setTimeout(() => {
        const current = buttons.findIndex(button => button.getAttribute("aria-selected") === "true");
        choose(buttons[(current + 1) % buttons.length].dataset.workspace);
        schedule();
      }, DWELL);
    };
    const stopTour = () => {
      if (!touring) return;
      touring = false;
      clearTimeout(timer);
      choices.classList.remove("is-touring");
      caption.setAttribute("aria-live", "polite");
    };
    if (touring) {
      choices.classList.add("is-touring");
      // Silent while touring: a screen reader should not hear a new caption every few seconds.
      caption.setAttribute("aria-live", "off");
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        schedule();
      }, { threshold: 0.25 }).observe(preview);
      document.addEventListener("visibilitychange", schedule);
      const hold = (value) => () => {
        held = value || pill.matches(":hover") || pill.contains(document.activeElement);
        schedule();
      };
      pill.addEventListener("pointerenter", hold(true));
      pill.addEventListener("pointerleave", hold(false));
      pill.addEventListener("focusin", hold(true));
      pill.addEventListener("focusout", () => setTimeout(hold(false)));
      reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) stopTour(); });
    }

    for (const [index, button] of buttons.entries()) {
      const name = button.dataset.workspace;
      button.addEventListener("click", () => {
        stopTour();
        choose(name);
      });
      for (const event of ["pointerenter", "focus"]) button.addEventListener(event, () => preload(name).catch(() => {}));
      button.addEventListener("keydown", event => {
        const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: buttons.length - 1 - index };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        const next = buttons[(index + offsets[event.key] + buttons.length) % buttons.length];
        stopTour();
        next.focus();
        choose(next.dataset.workspace);
      });
    }
    choices.hidden = false;
    preview.classList.add("has-workspace-choices");
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) image.getAnimations().forEach(animation => animation.cancel());
    });
  }

  const appearance = document.getElementById("appearance");
  const allowedThemes = new Set(["light", "dark"]);
  let preference = "dark";
  try {
    const saved = localStorage.getItem("flux-site-appearance");
    if (allowedThemes.has(saved)) preference = saved;
  } catch {
    /* Storage can be unavailable in privacy modes. */
  }
  function applyAppearance(value) {
    root.setAttribute("data-theme", value);
    if (appearance) appearance.value = value;
  }
  applyAppearance(preference);
  appearance?.addEventListener("change", () => {
    const next = allowedThemes.has(appearance.value)
      ? appearance.value
      : "dark";
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
        allowedThemes.has(event.newValue) ? event.newValue : "dark",
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
        dialog.classList.toggle("is-tall", Number(image?.getAttribute("height")) > Number(image?.getAttribute("width")));
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

  // The native Flux player is loaded on request. The website chooses the scene, starts the
  // first step once the visitor has asked to play, and pauses the player when it is out of view.
  const demo = document.getElementById("slide-demo");
  const launch = demo?.querySelector("[data-demo-start]");
  const sceneTabs = [...document.querySelectorAll(".scene-tabs button[data-scene]")];
  let demoFrame = null;
  let requestedScene = Number(demo?.dataset.demoScene ?? 0);
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
  function markScene(index) {
    for (const tab of sceneTabs) tab.setAttribute("aria-pressed", String(Number(tab.dataset.scene) === index));
  }
  function chooseScene(index, play) {
    requestedScene = index;
    markScene(index);
    demoFrame?.contentWindow?.fluxWebsiteDemo?.select(index, play && !reducedMotion.matches);
  }
  // The native control bar can wrap on narrow screens or with larger text.
  window.addEventListener("message", (event) => {
    if (!demoFrame || event.source !== demoFrame.contentWindow || event.origin !== window.location.origin) return;
    if (event.data?.type === "flux-demo-selected" && sceneTabs.some(tab => Number(tab.dataset.scene) === event.data.index)) {
      requestedScene = event.data.index;
      markScene(requestedScene);
      return;
    }
    if (event.data?.type !== "flux-demo-resize") return;
    const height = event.data.height;
    if (!Number.isFinite(height) || height <= 0 || height > 3000) return;
    demo.style.aspectRatio = "auto";
    demo.style.paddingBottom = "0";
    demo.style.height = `${Math.ceil(height)}px`;
  });
  function loadDemo() {
    if (demoFrame) return;
    demoFrame = document.createElement("iframe");
    demoFrame.src = `${demo.dataset.demoSrc}#scene=${requestedScene}`;
    demoFrame.title = "Interactive Flux slides";
    demoFrame.setAttribute("allow", "fullscreen");
    demoFrame.setAttribute("loading", "eager");
    demoFrame.addEventListener(
      "load",
      () => {
        notifyDemo("motion-preference", { reducedMotion: reducedMotion.matches });
        chooseScene(requestedScene, true);
        // An intentional launch may enter the player. Loading never occurs on page arrival.
        demoFrame.focus({ preventScroll: true });
      },
      { once: true },
    );
    demo.replaceChildren(demoFrame);
  }
  launch?.addEventListener("click", loadDemo);
  if (sceneTabs.length && demo) {
    sceneTabs[0].parentElement.hidden = false;
    markScene(requestedScene);
    for (const tab of sceneTabs) tab.addEventListener("click", () => {
      const index = Number(tab.dataset.scene);
      if (demoFrame) chooseScene(index, true);
      else { requestedScene = index; markScene(index); loadDemo(); }
    });
  }
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
