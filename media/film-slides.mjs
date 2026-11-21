/** Slides selected from the owner's launch-film decks for the website. Each slide is exported
 *  unchanged; only the player title is shortened. Credits follow each slide's own source notes. */
export const FILM_DECKS=['deck_muyqzusk33zg_21','deck_muzr6gljt5vd_46'];
const FILM='deck_muyqzusk33zg_21',FIG11='deck_muzr6gljt5vd_46';
export const MOTION='deck_mwlhqg7l74tm_533';
const usgs='<a href="https://earthquake.usgs.gov/earthquakes/search/" target="_top">USGS earthquake catalog</a>';
const cellTypes='<a href="https://celltypes.brain-map.org/experiment/morphology/480114344" target="_top">Allen Cell Types Database</a>';

/** The homepage opens on Japan’s earthquakes, followed by the other authored Plots in Motion and film slides. */
export const HOMEPAGE=[
 {deck:MOTION,slide:'slide_mwlr2r2w8f1w_1',posterStep:1,
  alt:'Map of Japan showing earthquakes by depth and a band across northern Honshu that the slide turns into a depth section.',
  credit:`Earthquakes: ${usgs}, magnitude 5 and above, 1975–2025. Relief: ETOPO1`},
 {deck:MOTION,slide:'slide_mwlr2pnj1w9c_1',
  alt:'The Moon’s illuminated face through its orbit and the corresponding phases as seen from Earth.',
  credit:'Computed illustration of the lunar phases'},
 {deck:MOTION,slide:'slide_mwlr2xk7bs6r_1',
  alt:'A reconstructed visual-cortex neuron whose branches rearrange into a tree showing distance along each branch.',
  credit:`Mouse visual cortex reconstruction 491771446, ${cellTypes}`},
 {deck:MOTION,slide:'slide_mwlr2ptk1w9c_589',
  alt:'Seeds radiating from a sunflower center, with the pattern changing as the angle between successive seeds changes.',
  credit:'Computed phyllotaxis patterns'},
 {deck:FILM,slide:'slide_muz2tp5izb92_249',title:'Shapes that change shape',
  alt:'Two 3D surfaces on black: a sphere and a minimal surface.',
  credit:'Computed geometry: a superquadric and the catenoid–helicoid family'},
 {deck:FIG11,slide:'slide_muzr6gllt5vd_47',title:'Any figure can become a slide',
  alt:'A slide titled “In Flux, any figure can become a slide”: the dots of the Flux mark have become five coloured shapes in a frame and the caption “and adding motion is effortless”.',
  credit:'The Flux mark and shapes, drawn in Flux'},
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
