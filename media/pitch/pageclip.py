#!/usr/bin/env python3
"""Developer aid: put an installed clip into its slot on the tour page.

    python3 media/pitch/pageclip.py <name> "<aria-label>" "<caption html>" [--para "<replacement paragraph for the tour-step before it>"]

Replaces the `<!-- clip:<name> -->` marker in site/in-60-seconds/index.qmd with the clip figure
(or updates an existing figure for that clip). Clips load and start only when scrolled to."""
import html, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
page = os.path.join(root, "site/in-60-seconds/index.qmd")
name, label, caption = sys.argv[1:4]
para = sys.argv[sys.argv.index("--para") + 1] if "--para" in sys.argv else None
for f in (f"{name}.mp4", f"{name}-1280.mp4", f"{name}.webp"):
    assert os.path.exists(os.path.join(root, "site/assets/media/pitch", f)), f"not installed: {f}"
block = f'''```{{=html}}
<figure class="doc-clip article-clip"><video poster="/assets/media/pitch/{name}.webp" width="1920" height="1440" muted loop playsinline controls preload="none" aria-label="{html.escape(label, quote=True)}"><source src="/assets/media/pitch/{name}-1280.mp4" type="video/mp4" media="(max-width: 700px)"><source src="/assets/media/pitch/{name}.mp4" type="video/mp4"></video><figcaption><span>{caption}</span></figcaption></figure>
```'''
s = open(page).read()
marker = f"<!-- clip:{name} -->"
existing = re.compile(r"```\{=html\}\n<figure class=\"doc-clip article-clip\"><video poster=\"/assets/media/pitch/" + re.escape(name) + r"\.webp\".*?\n```", re.S)
if marker in s:
    at = s.index(marker)
    s = s.replace(marker, block)
elif existing.search(s):
    at = existing.search(s).start()
    s = existing.sub(lambda m: block, s)
else:
    sys.exit(f"no slot for {name}")
if para:
    # the tour-step block immediately before the clip
    start = s.rfind("::: {.tour-step}\n", 0, at)
    end = s.index("\n:::", start)
    s = s[:start] + "::: {.tour-step}\n" + para.strip() + s[end:]
open(page, "w").write(s)
print("placed", name)
