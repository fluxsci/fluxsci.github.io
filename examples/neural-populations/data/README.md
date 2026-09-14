# Example-project data

All source data for this project live in [`allen/`](allen/README.md). This is the only
canonical copy in the website repository.

- **Functional responses:** 143 cells from Allen Brain Observatory experiment 501940850,
  with responses to eight motion directions and five temporal frequencies, trial tables,
  mean traces, and cell metrics.
- **Anatomical context:** four mouse brain-region meshes and three independent neuron
  reconstructions from Allen public datasets.
- **Provenance:** [`allen/provenance.json`](allen/provenance.json) contains exact source URLs
  and checksums. [`allen/sources.bib`](allen/sources.bib) contains dataset references.
- **Reuse:** these Allen data retain the provider's noncommercial terms and attribution
  requirements. Read [`allen/README.md`](allen/README.md) before repurposing them.

The project narrative and figures are original Flux demonstration material. The underlying
measurements are public data; the example does not report a new scientific finding.

To verify or regenerate the compact data inputs, see the standalone commands in
[`allen/README.md`](allen/README.md#reproduce-or-verify). Plot recipes and exported graphics
live in the project's `plots/` folder.
