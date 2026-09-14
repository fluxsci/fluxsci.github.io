# Agents: read the Context folders

This is a Flux project. All agent context, memory, and instructions live in two places:

1. **Machine level:** `<FluxConfig>/Context` (run `flux config` for the absolute
   path — the `contextPath` field) — who the user is (`UserContext/`) and how to
   work in Flux (`FluxContext/` — start with its `README.md`; the full
   inside-a-project reference is `FluxContext/PROJECT-GUIDE.md`).
2. **Project level:** `Context/` in this folder — the mission
   (`Project/MISSION.qmd`), the running notebook (`NOTEBOOK.md`), and this
   project's rules (`RULES.md`).

If you are the **principal** (the user's standing collaborator), follow
`FluxContext/PRINCIPAL.md`. If you are a **dispatched worker**, your brief is your
contract — see `FluxContext/WORKERS.md`.
