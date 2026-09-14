"""Give generated morph states stable SVG definition identities.

Fluxplot salts Matplotlib marker and clip-path IDs with the output basename.
Those internal IDs must also agree between states, in addition to the public
series and point identities. Otherwise a content interpolation can retain one
definition ID while changing a <use> or clip reference to another state's ID.

Call immediately after fp.save for each morph state, before recording hashes.
This is part of generating these new assets, never a migration of user plots.
Only IDs inside <defs> and their references change; data and geometry do not.
The SVG's original formatting is retained, then the manifest checksum is
recomputed. A repeated invocation is byte-identical and writes nothing.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET


def stabilize_morph_references(svg_path: str | Path) -> dict:
    svg_path = Path(svg_path)
    manifest_path = svg_path.with_suffix(".fluxplot.json")
    source = svg_path.read_text()
    root = ET.fromstring(source)
    ids = []

    def visit(node, inside_defs=False):
        inside_defs = inside_defs or node.tag.rsplit("}", 1)[-1] == "defs"
        if inside_defs and node.get("id"):
            ids.append(node.get("id"))
        for child in node:
            visit(child, inside_defs)

    visit(root)
    if len(ids) != len(set(ids)):
        raise ValueError(f"Duplicate source definition IDs in {svg_path}")
    mapping = {old: f"morph-def-{i:03d}" for i, old in enumerate(ids)}
    outside_ids = {node.get("id") for node in root.iter() if node.get("id")} - set(ids)
    if outside_ids.intersection(mapping.values()):
        raise ValueError(f"Generated definition ID collides with a semantic part in {svg_path}")

    # Single passes prevent a newly assigned ID from being renamed a second time.
    # Matplotlib uses quoted id/href attributes and url(#...) for internal refs.
    def attribute(match):
        name, quote, value = match.group(1), match.group(2), match.group(3)
        if name == "id":
            value = mapping.get(value, value)
        elif value.startswith("#"):
            value = "#" + mapping.get(value[1:], value[1:])
        return f"{name}={quote}{value}{quote}"

    result = re.sub(r"\b(id|href|xlink:href)=([\"'])(.*?)\2", attribute, source)
    result = re.sub(r"url\(#([^)]*)\)", lambda m: "url(#" + mapping.get(m[1], m[1]) + ")", result)
    manifest = json.loads(manifest_path.read_text())

    def references(value):
        if isinstance(value, dict):
            return {k: references(v) for k, v in value.items()}
        if isinstance(value, list):
            return [references(v) for v in value]
        return mapping.get(value, value) if isinstance(value, str) else value

    manifest = references(manifest)
    checksum = hashlib.sha256(result.encode()).hexdigest()
    manifest.setdefault("artifact", {})["svgSha256"] = checksum
    manifest_bytes = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    if result != source:
        svg_path.write_text(result)
    if manifest_path.read_text() != manifest_bytes:
        manifest_path.write_text(manifest_bytes)
    return {"definitions": len(ids), "sha256": checksum}
