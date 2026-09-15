/* Progressive enhancements only: the page and all guide/image links work without JS. */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // The ornament drifts as one object. Freeze its phase while it is out of
  // view, in a background tab, or paused by the visitor.
  const emblem = document.querySelector(".hero-emblem");
  if (emblem) {
    const control = emblem.querySelector(".emblem-motion");
    let visible = false;
    let paused = false;
    try { paused = sessionStorage.getItem("flux-emblem-paused") === "1"; } catch { /* Optional persistence. */ }
    const updateMotion = () => {
      const running = visible && !document.hidden && !paused && !reducedMotion.matches;
      emblem.style.setProperty("--emblem-motion-state", running ? "running" : "paused");
      control.hidden = reducedMotion.matches;
      control.classList.toggle("is-paused", paused);
      const label = paused ? "Resume logo motion" : "Pause logo motion";
      control.setAttribute("aria-label", label);
      control.title = label;
    };
    control.addEventListener("click", () => {
      paused = !paused;
      try { sessionStorage.setItem("flux-emblem-paused", paused ? "1" : "0"); } catch { /* Optional persistence. */ }
      updateMotion();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        updateMotion();
      }).observe(emblem);
    } else {
      visible = true;
    }
    document.addEventListener("visibilitychange", updateMotion);
    reducedMotion.addEventListener("change", updateMotion);
    updateMotion();
  }

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
      paper: ["Paper", "Write with your figures, citations, and working notes in reach.", "Flux Paper workspace with the neural-populations manuscript, project documents, and its composed neuroscience figure."],
      figure: ["Figure", "Compose the whole figure. Refine every individual part.", "Flux Figure workspace with the editable multi-panel neuroscience composition and its layers."],
      slides: ["Slides", "Give the same figures a timeline. Build the explanation step by step.", "Flux Slides workspace with the neural-populations deck and its editable animation steps."],
      library: ["Library", "A lasting collection of references, ready for every project.", "Flux Library workspace with the public neuroscience collection, paper metadata, and organization controls."],
      reader: ["Reader", "Read closely. Keep your notes connected to the evidence.", "Flux Reader workspace displaying the original neuroscience manuscript and its reading tools."],
    };
    const loads = new Map();
    let request = 0;
    let selected = "paper";
    const preload = (name) => {
      if (!loads.has(name)) {
        const next = new Image();
        next.src = `assets/media/${name}.webp`;
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
        guide.href = `#${name}`;
        guide.replaceChildren(document.createTextNode(`Explore ${title}`));
        const arrow = document.createElement("span");
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↓";
        guide.append(arrow);
        for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.workspace === name));
        selected = name;
      } catch {
        if (token === request) caption.textContent = "This preview could not load. Explore the modules below.";
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

  // The semantic-plot explorer: the browser reads a real fluxplot SVG from the
  // example project and names the part under the pointer. Switching to a
  // regenerated state moves the same named points and curves to their new
  // values and keeps any restyle attached by id, which is what a Flux figure
  // does when a linked plot regenerates. Nothing here reproduces the app; it
  // is the file format, inspected.
  const xray = document.querySelector("[data-xray]");
  if (xray && "fetch" in window && "DOMParser" in window) setupXray(xray);

  function setupXray(container) {
    const stage = container.querySelector("[data-xray-stage]");
    const readout = container.querySelector("[data-xray-readout]");
    const partsList = container.querySelector("[data-xray-parts]");
    const command = container.querySelector("[data-xray-command]");
    const fileName = container.querySelector("[data-xray-file]");
    const stateButtons = [...container.querySelectorAll("[data-xray-state]")];
    const states = container.dataset.states.split(";").map((entry) => {
      const [label, url, file] = entry.split("|");
      return { label, url, file, text: null, promise: null };
    });
    const figureId = container.dataset.figure || "figure";
    const ACCENTS = ["#205ea6", "#bc5215", "#66800b", "#5e409d", "#24837b", "#a02f6f", "#ad8301", "#af3029"];
    const PREFIX = "xr-";
    const restyles = new Map();
    let current = Number(container.dataset.initial || 0);
    let svg = null;
    let hot = null;
    let tweening = false;
    let started = false;

    const originalId = (element) => (element?.id || "").replace(PREFIX, "");
    const partOf = (target) => {
      if (target instanceof Element && target.dataset.for)
        target = svg?.querySelector(`[id="${target.dataset.for}"]`) || target;
      const part = target instanceof Element ? target.closest("[data-role]") : null;
      if (!part || !svg || !svg.contains(part)) return null;
      const role = part.dataset.role;
      if (role === "figure" || role === "plot-area") return null;
      return part;
    };
    const seriesOf = (part) => part.dataset.series || null;
    const seriesPartId = (part) => {
      const series = seriesOf(part);
      if (!series) return originalId(part);
      return `${series}.${part.dataset.role === "point" ? "points" : part.dataset.role}`;
    };
    const colorOf = (part) => {
      const element = part.matches("use") ? part : part.querySelector("path, text") || part;
      const style = getComputedStyle(element);
      return part.dataset.role === "point" ? style.fill : style.stroke;
    };

    function load(index) {
      const state = states[index];
      if (!state.promise) {
        state.promise = fetch(state.url)
          .then((response) => {
            if (!response.ok) throw new Error(`${response.status} ${state.url}`);
            return response.text();
          })
          .then((text) => (state.text = text));
      }
      return state.promise;
    }

    function parse(text) {
      // Ids and references get a prefix so an inlined plot can never collide
      // with the page's own anchors, and the plot's global <style> is scoped.
      const prepared = text
        .replace(/<\?xml[^>]*\?>/, "")
        .replace(/\bid="([^"]+)"/g, `id="${PREFIX}$1"`)
        .replace(/url\(#/g, `url(#${PREFIX}`)
        .replace(/href="#/g, `href="#${PREFIX}`)
        .replace(/<style[^>]*>[\s\S]*?<\/style>/, (block) => block.replace(/\*\s*\{/g, ".xray-stage svg *{"));
      const documentNode = new DOMParser().parseFromString(prepared, "image/svg+xml");
      const element = document.importNode(documentNode.documentElement, true);
      element.removeAttribute("width");
      element.removeAttribute("height");
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", stage.querySelector("img")?.alt || "A fluxplot plot");
      element.setAttribute("focusable", "false");
      return element;
    }

    function applyRestyles(target = svg) {
      if (!target) return;
      for (const [series, color] of restyles) {
        const line = target.querySelector(`[data-series="${series}"][data-role="line"] > path:not(.xray-hit)`);
        if (line) line.style.stroke = color;
        target
          .querySelectorAll(`[data-series="${series}"][data-role="point"]`)
          .forEach((point) => {
            point.style.fill = color;
          });
      }
    }

    function describe(part) {
      readout.replaceChildren();
      if (!part) {
        const hint = document.createElement("p");
        hint.className = "xray-hint";
        hint.textContent = "Move over a curve, a point or an axis label to see its name. Click a curve or point to restyle that series.";
        readout.append(hint);
        return;
      }
      const role = document.createElement("span");
      role.className = "xray-role";
      role.textContent = part.dataset.role.replace(/^x-/, "");
      const id = document.createElement("code");
      id.className = "xray-id";
      id.textContent = originalId(part);
      readout.append(role, id);
      const facts = [];
      if (part.dataset.series) facts.push(["series", part.dataset.series]);
      if (part.dataset.index !== undefined) facts.push(["index", part.dataset.index]);
      if (part.dataset.axis) facts.push(["axis", part.dataset.axis]);
      if (part.dataset.x !== undefined) facts.push(["x", `${Number(part.dataset.x).toFixed(0)}°`]);
      if (part.dataset.y !== undefined) facts.push(["y", Number(part.dataset.y).toFixed(3)]);
      const text = part.querySelector("text");
      if (text && !part.dataset.series) facts.push(["text", text.textContent.trim()]);
      if (facts.length) {
        const list = document.createElement("dl");
        list.className = "xray-facts";
        for (const [key, value] of facts) {
          const dt = document.createElement("dt");
          dt.textContent = key;
          const dd = document.createElement("dd");
          dd.textContent = value;
          list.append(dt, dd);
        }
        readout.append(list);
      }
    }

    function highlight(part) {
      if (!svg) return;
      if (hot) hot.classList.remove("xray-hot");
      svg.querySelectorAll(".xray-dim").forEach((element) => element.classList.remove("xray-dim"));
      hot = part;
      stage.classList.toggle("is-hovering", !!part);
      if (!part) return;
      part.classList.add("xray-hot");
      const series = seriesOf(part);
      if (!series) return;
      const cell = series.replace(/-(guide|means)$/, "");
      svg.querySelectorAll("[data-series]").forEach((element) => {
        if (!element.dataset.series.startsWith(cell)) element.classList.add("xray-dim");
      });
    }

    function highlightSeries(series) {
      if (!svg) return;
      const part = svg.querySelector(`[data-series="${series}"]`);
      highlight(part);
      describe(part);
    }

    function sameColor(a, b) {
      const probe = document.createElement("span");
      probe.style.color = a;
      const first = probe.style.color;
      probe.style.color = b;
      return first !== "" && first === probe.style.color;
    }

    function restyle(part) {
      const series = seriesOf(part);
      if (!series) return;
      const currentColor = restyles.get(series) || colorOf(part);
      const index = ACCENTS.findIndex((accent) => sameColor(accent, currentColor));
      const color = ACCENTS[(index + 1) % ACCENTS.length];
      restyles.set(series, color);
      applyRestyles();
      renderParts();
      if (command)
        command.textContent = `flux restyle ${figureId} ${seriesPartId(part)} --${part.dataset.role === "point" ? "fill" : "stroke"} '${color}'`;
    }

    function renderParts() {
      if (!partsList || !svg) return;
      partsList.replaceChildren();
      const seen = new Set();
      svg.querySelectorAll("[data-series][data-role='line']").forEach((element) => {
        const series = element.dataset.series;
        if (seen.has(series)) return;
        seen.add(series);
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.series = series;
        const swatch = document.createElement("i");
        swatch.style.setProperty("--swatch", restyles.get(series) || colorOf(element));
        button.append(swatch, document.createTextNode(series));
        const clear = () => {
          highlight(null);
          describe(null);
        };
        button.addEventListener("pointerenter", () => highlightSeries(series));
        button.addEventListener("focus", () => highlightSeries(series));
        button.addEventListener("pointerleave", clear);
        button.addEventListener("blur", clear);
        button.addEventListener("click", () => {
          const part = svg.querySelector(`[data-series="${series}"][data-role="line"]`);
          if (!part) return;
          restyle(part);
          highlightSeries(series);
        });
        item.append(button);
        partsList.append(item);
      });
    }

    function decorate(element) {
      // Thin strokes and 1.4-unit markers are hard to point at; each curve gets an
      // invisible wide twin and each point an invisible disc that resolve back to
      // the named part they belong to.
      element.querySelectorAll('[data-role="line"] > path').forEach((path) => {
        const hit = path.cloneNode(false);
        hit.removeAttribute("id");
        hit.setAttribute("class", "xray-hit");
        hit.setAttribute("style", "fill:none;stroke:#000;stroke-opacity:0;stroke-width:6;pointer-events:stroke");
        path.after(hit);
      });
      element.querySelectorAll('use[data-role="point"]').forEach((point) => {
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hit.setAttribute("class", "xray-hit");
        hit.setAttribute("cx", point.getAttribute("x"));
        hit.setAttribute("cy", point.getAttribute("y"));
        hit.setAttribute("r", "4");
        hit.setAttribute("style", "fill:#000;fill-opacity:0;pointer-events:all");
        hit.dataset.for = point.id;
        point.after(hit);
      });
    }

    function mount(element, index) {
      decorate(element);
      applyRestyles(element);
      if (svg) svg.replaceWith(element);
      else stage.querySelector("img")?.replaceWith(element);
      svg = element;
      hot = null;
      current = index;
      if (fileName) fileName.textContent = states[index].file || "";
      stateButtons.forEach((button, k) => button.setAttribute("aria-pressed", String(k === index)));
      renderParts();
    }

    function polyline(d) {
      const numbers = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) || [];
      const points = [];
      for (let k = 0; k + 1 < numbers.length; k += 2) points.push([numbers[k], numbers[k + 1]]);
      return points;
    }

    function sampleY(points, x) {
      if (x <= points[0][0]) return points[0][1];
      for (let k = 1; k < points.length; k++) {
        if (x <= points[k][0]) {
          const [x0, y0] = points[k - 1];
          const [x1, y1] = points[k];
          const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
          return y0 + (y1 - y0) * t;
        }
      }
      return points[points.length - 1][1];
    }

    function blendPath(a, b, t) {
      const x0 = Math.min(a[0][0], b[0][0]);
      const x1 = Math.max(a[a.length - 1][0], b[b.length - 1][0]);
      const steps = 96;
      let d = "";
      for (let k = 0; k <= steps; k++) {
        const x = x0 + ((x1 - x0) * k) / steps;
        const y = sampleY(a, x) + (sampleY(b, x) - sampleY(a, x)) * t;
        d += `${k ? " L " : "M "}${x.toFixed(3)} ${y.toFixed(3)}`;
      }
      return d;
    }

    async function goTo(index) {
      if (index === current || tweening || index < 0 || index >= states.length) return;
      let next;
      try {
        next = parse(await load(index));
      } catch {
        return;
      }
      if (!svg || reducedMotion.matches) {
        mount(next, index);
        return;
      }
      const moves = [];
      next.querySelectorAll('use[data-role="point"]').forEach((target) => {
        const source = svg.querySelector(`[id="${target.id}"]`);
        if (!source) return;
        moves.push({
          kind: "point",
          element: source,
          hit: source.nextElementSibling?.classList.contains("xray-hit") ? source.nextElementSibling : null,
          x0: Number(source.getAttribute("x")),
          y0: Number(source.getAttribute("y")),
          x1: Number(target.getAttribute("x")),
          y1: Number(target.getAttribute("y")),
        });
      });
      next.querySelectorAll('[data-role="line"] > path').forEach((target) => {
        const source = svg.querySelector(`[id="${target.parentNode.id}"] > path`);
        if (!source) return;
        moves.push({
          kind: "line",
          element: source,
          hit: source.nextElementSibling?.classList.contains("xray-hit") ? source.nextElementSibling : null,
          a: polyline(source.getAttribute("d")),
          b: polyline(target.getAttribute("d")),
        });
      });
      tweening = true;
      stateButtons.forEach((button) => {
        button.disabled = true;
      });
      highlight(null);
      describe(null);
      const duration = 760;
      const start = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const frame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = ease(t);
        for (const move of moves) {
          if (move.kind === "point") {
            const x = (move.x0 + (move.x1 - move.x0) * e).toFixed(3);
            const y = (move.y0 + (move.y1 - move.y0) * e).toFixed(3);
            move.element.setAttribute("x", x);
            move.element.setAttribute("y", y);
            move.hit?.setAttribute("cx", x);
            move.hit?.setAttribute("cy", y);
          } else {
            const d = blendPath(move.a, move.b, e);
            move.element.setAttribute("d", d);
            move.hit?.setAttribute("d", d);
          }
        }
        if (t < 1) requestAnimationFrame(frame);
        else {
          mount(next, index);
          tweening = false;
          stateButtons.forEach((button) => {
            button.disabled = false;
          });
        }
      };
      requestAnimationFrame(frame);
    }

    function start() {
      if (started) return;
      started = true;
      load(current)
        .then((text) => {
          mount(parse(text), current);
          describe(null);
          container.classList.add("is-live");
          const prefetch = () => states.forEach((_, k) => k !== current && load(k).catch(() => {}));
          if ("requestIdleCallback" in window) requestIdleCallback(prefetch);
          else setTimeout(prefetch, 800);
        })
        .catch(() => {
          /* The fallback image and text remain. */
        });
    }

    stage.addEventListener("pointerover", (event) => {
      const part = partOf(event.target);
      if (part === hot) return;
      highlight(part);
      describe(part);
    });
    stage.addEventListener("pointerleave", () => {
      highlight(null);
      describe(null);
    });
    stage.addEventListener("click", (event) => {
      const part = partOf(event.target);
      if (!part || !seriesOf(part)) return;
      restyle(part);
      highlight(part);
      describe(part);
    });
    stateButtons.forEach((button) =>
      button.addEventListener("click", () => goTo(Number(button.dataset.xrayState))),
    );
    container.xray = { goTo, state: () => current, restyles, ready: () => !!svg };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            start();
          }
        },
        { rootMargin: "400px 0px" },
      );
      observer.observe(container);
    } else start();
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
