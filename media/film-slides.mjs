/** Slides selected from the owner's launch-film decks for the website. Each slide is exported
 *  unchanged; only the player title is shortened. Credits follow each slide's own source notes. */
export const DECKS=['deck_muyqzusk33zg_21','deck_muzr6gljt5vd_46'];
const FILM='deck_muyqzusk33zg_21',FIG11='deck_muzr6gljt5vd_46';
const allen='<a href="https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/" target="_top">Allen CCF2017</a>';

/** The homepage plays the launch film's slideshow, in the film's order. */
export const HOMEPAGE=[
 {deck:FIG11,slide:'slide_muzr6gllt5vd_47',title:'Any figure can become a slide',
  alt:'A slide titled “In Flux, any figure can become a slide”: the dots of the Flux mark have become five coloured shapes in a frame and the caption “and adding motion is effortless”.',
  credit:'The Flux mark and shapes, drawn in Flux'},
 {deck:FILM,slide:'slide_muz2tp5izb92_249',title:'Shapes that change shape',
  alt:'Two 3D surfaces on black: a sphere and a minimal surface.',
  credit:'Computed geometry: a superquadric and the catenoid–helicoid family'},
 {deck:FILM,slide:'slide_muz1bgcmzb92_3',title:'Visual response latency across brain regions',
  alt:'Twelve brain regions on a mouse coronal section, each matched to a row of visual response latencies.',
  credit:`Anatomy: ${allen}. Latency values are synthetic and illustrative`},
 {deck:FILM,slide:'slide_muz991ncyfxw_867',title:'The fold becomes a fingerprint',
  alt:'The folded backbone of the protein crambin and its residue contact map.',
  credit:'Structure: crambin, <a href="https://www.rcsb.org/structure/1CRN" target="_top">PDB 1CRN</a>'},
 {deck:FILM,slide:'slide_muzb9z5cakd6_9141',title:'From genes to programs',
  alt:'A heat map of 36 genes across eight airway samples, regrouped into three expression programs.',
  credit:'Data: airway RNA-seq, <a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE52778" target="_top">GEO GSE52778</a>'},
 {deck:FILM,slide:'slide_muzb9z5kakd6_13448',title:'Agreement, revealed',
  alt:'240 paired blood-pressure readings as a scatter plot with r = 0.974, and the same pairs as a mean–difference plot.',
  credit:'Data: <a href="https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BPX_J.htm" target="_top">NHANES 2017–2018</a> systolic readings'},
];

/** One film slide per documentation example. `id` names the page each guide loads. */
export const STUDIES=[
 {id:'entrances',deck:FILM,slide:'slide_muz5936w7l1c_1',title:'Central limit theorem',
  alt:'Central limit theorem: a skewed population of dots and a normal curve over 100 sample means.',
  credit:'Simulated samples from a Gamma population'},
 {id:'easing',deck:FILM,slide:'slide_muzb9z5fakd6_11159',title:'Spikes to rate',
  alt:'A spike raster from 24 trials becomes a histogram and a smooth firing-rate estimate.',
  credit:'Simulated spike trains'},
 {id:'emphasis',deck:FILM,slide:'slide_muz5ze1lh75f_1',title:'Spatial transcriptomics',
  alt:'A tumour section on a hexagonal spot grid beside a UMAP of the same spots, with the immune cluster highlighted in both.',
  credit:'Simulated expression on a Visium-style spot grid'},
 {id:'change',deck:FILM,slide:'slide_muz991npyfxw_3014',title:'Phyllotaxis',
  alt:'233 seeds arranged by the golden angle, with the 13 and 21 spiral families drawn through them.',
  credit:'Vogel’s model of phyllotaxis, computed'},
 {id:'ghost',deck:FILM,slide:'slide_muz991nvyfxw_4711',title:'Shadows contain a shape',
  alt:'Projections of three disks collected into a sinogram, then backprojected into a blurred image of the disks.',
  credit:'Exact parallel-beam projections of three disks, computed'},
 {id:'become',deck:FIG11,slide:'slide_muzr6gllt5vd_47',title:'Any figure can become a slide',
  alt:'The dots of the Flux mark have become five coloured shapes and a caption.',
  credit:'The Flux mark and shapes, drawn in Flux'},
];
