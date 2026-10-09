/* Part explorer: a real fluxplot SVG whose named parts can be inspected on the page.
   Progressive: without scripts the plot is an ordinary image and the prose still names the parts. */
(() => {
  'use strict';
  const NAMES = { figure: 'Figure', 'plot-area': 'Plot area', background: 'Background', axis: 'Axis', spine: 'Spine', tick: 'Tick', 'tick-label': 'Tick label', 'axis-title': 'Axis title', series: 'Series', point: 'Point', box: 'Box', whisker: 'Whiskers', median: 'Median', mean: 'Mean', group: 'Group', legend: 'Legend' };
  const GROUPS = { tick: 'Ticks', 'tick-label': 'Tick labels', gridline: 'Gridlines', point: 'Points', whisker: 'Whiskers', median: 'Median', mean: 'Mean', bar: 'Bars' };
  const fmt = v => (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : String(v));
  for (const box of document.querySelectorAll('[data-part-explorer]')) setup(box).catch(() => {});

  async function setup(box) {
    const data = JSON.parse(box.querySelector('script[type="application/json"]').textContent);
    const stage = box.querySelector('.explorer-stage');
    const image = stage.querySelector('img');
    const text = await (await fetch(image.src)).text();
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('SVG did not parse');
    const svg = document.adoptNode(parsed.documentElement);
    svg.removeAttribute('role');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('explorer-svg');
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overlay.setAttribute('class', 'explorer-overlay');
    overlay.setAttribute('pointer-events', 'none');
    svg.append(overlay);
    image.replaceWith(svg);

    // Index every named part from the manifest's parts tree, including grouped members.
    const index = new Map();
    const axisName = which => ({ x: 'x axis', y: 'y axis', z: 'z axis', x2: 'secondary x axis', y2: 'secondary y axis' }[which] || `${which} axis`);
    function visit(node, path, parent) {
      const id = node.id || node.ref;
      const role = node.role === 'group' ? 'group' : node.role;
      let name = NAMES[role] || role;
      if (role === 'axis') name = axisName(node.axis);
      else if (role === 'series') name = node.label || id;
      else if (role === 'group') name = GROUPS[node.groupRole] || `${node.groupRole} group`;
      else if (role === 'spine') name = `Spine (${id.split('.').pop()})`;
      else if (role === 'background') name = id.startsWith('figure') ? 'Figure background' : 'Plot background';
      const entry = { id, role, groupRole: node.groupRole, name, path: [...path, id], parent, node, children: [] };
      index.set(id, entry);
      if (parent) parent.children.push(entry);
      for (const child of node.children || []) visit(child, entry.path, entry);
      for (const [i, member] of (node.members || []).entries()) {
        const memberRole = node.memberRole || node.groupRole;
        const tail = member.split('.').pop();
        const label = `${NAMES[memberRole] || memberRole} ${/^\d+$/.test(tail) ? tail : ''}`.trim();
        const leaf = { id: member, role: memberRole, name: label, path: [...entry.path, member], parent: entry, node: { ref: member, role: memberRole }, children: [], order: i };
        index.set(member, leaf);
        entry.children.push(leaf);
      }
      return entry;
    }
    const root = visit(data.parts, [], null);

    // Facts: what the manifest knows about a part, in the terms the guide uses.
    const seriesOf = id => data.series[id.split('.')[0]];
    const axisOf = id => data.axes[id.split('.')[1]];
    function facts(entry) {
      const out = [];
      const s = seriesOf(entry.id), a = entry.id.startsWith('axis.') ? axisOf(entry.id) : null;
      const idx = Number(entry.id.split('.').pop());
      switch (entry.role) {
        case 'figure': out.push(['Plot type', data.plotType], ['Made with', `${data.generator.name} ${data.generator.version}`]); break;
        case 'plot-area': out.push(['x axis', `${data.axes.x.scale}, ${data.axes.x.label}`], ['y axis', `${data.axes.y.scale}, ${data.axes.y.label}`]); break;
        case 'axis': out.push(['Title', a.label], ['Scale', a.scale], ['Domain', a.domain.map(fmt).join(' to ')]); break;
        case 'tick': case 'tick-label': { const t = a?.ticks?.[idx]; if (t) out.push(['Position', fmt(t.value)], ['Label', t.label]); break; }
        case 'axis-title': out.push(['Text', a.label]); break;
        case 'series': out.push(['Label', s.label], ['Observations', s.n], ['Mean', fmt(s.mean)], ['Median', fmt(s.median)]); break;
        case 'point': { const p = s.points.find(p => p.id === entry.id); out.push(['Series', s.label], ['Index', idx]); if (p) out.push([data.axes.y.label, fmt(p.y)]); break; }
        case 'box': out.push(['Series', s.label], ['Q1 to Q3', `${fmt(s.q1)} to ${fmt(s.q3)}`], ['IQR', fmt(s.iqr)]); break;
        case 'whisker': out.push(['Series', s.label], ['Reach', `${fmt(s.whiskerLow)} to ${fmt(s.whiskerHigh)}`]); break;
        case 'median': out.push(['Series', s.label], ['Median', fmt(s.median)]); break;
        case 'mean': out.push(['Series', s.label], ['Mean', fmt(s.mean)]); break;
        case 'group': out.push(['Members', entry.children.length], ['Member role', entry.groupRole]); break;
        default: break;
      }
      if (s && entry.role !== 'figure') out.push(['Colour', s.color]);
      return out;
    }

    // Readout panel.
    const readout = box.querySelector('.explorer-readout');
    const hint = readout.innerHTML;
    function render(entry) {
      if (!entry) { readout.innerHTML = hint; return; }
      const crumbs = entry.path.map(id => index.get(id)?.name || id);
      const dl = facts(entry).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('');
      readout.innerHTML = `<p class="explorer-crumbs">${crumbs.map(esc).join('<span aria-hidden="true"> › </span>')}</p><code class="explorer-id">${esc(entry.id)}</code><span class="explorer-role">${esc(entry.role === 'group' ? `group of ${entry.groupRole}s` : entry.role)}</span>${dl ? `<dl class="explorer-facts">${dl}</dl>` : ''}`;
    }
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // Highlight: a selection box drawn in the plot's own coordinate space. Screen
    // rectangles are mapped back through the SVG's screen matrix, so the box lands on
    // the part whatever transforms, viewBox scaling or fonts are involved.
    const ns = 'http://www.w3.org/2000/svg';
    function highlight(entry) {
      overlay.replaceChildren();
      svg.querySelectorAll('.is-hot').forEach(el => el.classList.remove('is-hot'));
      if (!entry) return;
      const ids = entry.role === 'group' && entry.children.length ? entry.children.map(c => c.id) : [entry.id];
      const toUser = svg.getScreenCTM()?.inverse();
      if (!toUser) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const hot = [];
      for (const id of ids) {
        const el = svg.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        hot.push(el);
        const a = new DOMPoint(r.left, r.top).matrixTransform(toUser);
        const b = new DOMPoint(r.right, r.bottom).matrixTransform(toUser);
        x0 = Math.min(x0, a.x, b.x); y0 = Math.min(y0, a.y, b.y); x1 = Math.max(x1, a.x, b.x); y1 = Math.max(y1, a.y, b.y);
      }
      for (const el of hot) el.classList.add('is-hot');
      if (!Number.isFinite(x0)) return;
      const pad = 2.5;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x0 - pad); rect.setAttribute('y', y0 - pad);
      rect.setAttribute('width', x1 - x0 + pad * 2); rect.setAttribute('height', y1 - y0 + pad * 2);
      rect.setAttribute('class', 'explorer-box');
      overlay.append(rect);
      for (const [cx, cy] of [[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x0 - pad, y1 + pad], [x1 + pad, y1 + pad]]) {
        const h = document.createElementNS(ns, 'rect');
        h.setAttribute('x', cx - 1.4); h.setAttribute('y', cy - 1.4); h.setAttribute('width', 2.8); h.setAttribute('height', 2.8);
        h.setAttribute('class', 'explorer-handle');
        overlay.append(h);
      }
    }

    // A small label follows the pointer so the name is read where the eye already is.
    const tip = document.createElement('div');
    tip.className = 'explorer-tip';
    tip.hidden = true;
    stage.append(tip);
    function moveTip(event, entry) {
      if (!entry) { tip.hidden = true; return; }
      tip.innerHTML = `<span>${esc(entry.name)}</span><code>${esc(entry.id)}</code>`;
      tip.hidden = false;
      const bounds = stage.getBoundingClientRect();
      const x = Math.min(event.clientX - bounds.left + 14, bounds.width - tip.offsetWidth - 8);
      const y = Math.min(event.clientY - bounds.top + 18, bounds.height - tip.offsetHeight - 8);
      tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    }

    // Tree: every part the manifest names, in the order it names them.
    const tree = box.querySelector('.explorer-tree');
    const rows = new Map();
    function buildList(entry) {
      const ul = document.createElement('ul');
      for (const child of entry.children) {
        const li = document.createElement('li');
        const row = document.createElement('div'); row.className = 'explorer-row';
        const part = document.createElement('button'); part.type = 'button'; part.className = 'explorer-part'; part.dataset.part = child.id;
        part.innerHTML = `<span>${esc(child.name)}</span><code>${esc(child.id)}</code>`;
        if (child.children.length) {
          const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'explorer-toggle'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', `Show the parts inside ${child.name}`);
          const sub = buildList(child); sub.hidden = true;
          toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); sub.hidden = !open; });
          row.append(toggle, part); li.append(row, sub);
          rows.set(child.id, { row, toggle, sub, part });
        } else { row.classList.add('is-leaf'); row.append(part); li.append(row); rows.set(child.id, { row, part }); }
        part.addEventListener('pointerenter', () => preview(child));
        part.addEventListener('focus', () => preview(child));
        part.addEventListener('click', () => select(child, true));
        ul.append(li);
      }
      return ul;
    }
    tree.replaceChildren(buildList({ children: [root] }));
    for (const id of ['figure', 'plot-area']) { const r = rows.get(id); if (r?.toggle) { r.toggle.setAttribute('aria-expanded', 'true'); r.sub.hidden = false; } }
    tree.addEventListener('pointerleave', () => preview(null));

    // Selection: hovering previews a part; clicking keeps it; Escape or a second click releases it.
    let pinned = null, shown = null;
    function show(entry) {
      shown = entry; render(entry); highlight(entry);
      tree.querySelectorAll('[aria-current]').forEach(el => el.removeAttribute('aria-current'));
      if (entry) rows.get(entry.id)?.part.setAttribute('aria-current', 'true');
    }
    function preview(entry) { if (!pinned) show(entry); }
    function select(entry, fromTree = false) {
      if (pinned && pinned.id === entry.id) { pinned = null; box.classList.remove('is-pinned'); show(entry); return; }
      pinned = entry; box.classList.add('is-pinned'); show(entry);
      // Keeping a part also reveals what it contains and where it sits in the tree.
      let p = entry;
      while (p) { const r = rows.get(p.id); if (r?.toggle) { r.toggle.setAttribute('aria-expanded', 'true'); r.sub.hidden = false; } p = p.parent; }
      if (!fromTree) rows.get(entry.id)?.part.scrollIntoView({ block: 'nearest' });
    }
    const target = event => { const el = event.target.closest('[data-role]'); if (!el) return null; let node = el; while (node && node !== svg) { const entry = node.id && index.get(node.id); if (entry) return entry; node = node.parentNode; } return null; };
    svg.addEventListener('pointermove', event => { const entry = target(event); if (entry !== shown || !entry) preview(entry); moveTip(event, entry); });
    svg.addEventListener('pointerleave', () => { preview(null); tip.hidden = true; });
    svg.addEventListener('click', event => { const entry = target(event); if (entry) select(entry); });
    function release() { pinned = null; box.classList.remove('is-pinned'); show(null); if (box.contains(document.activeElement)) document.activeElement.blur(); }
    box.addEventListener('keydown', event => { if (event.key === 'Escape' && pinned) release(); });
    box.querySelector('[data-explorer-clear]')?.addEventListener('click', release);
    box.classList.add('is-live');
  }
})();
