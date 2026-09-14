#!/usr/bin/env python3
"""Fetch a bounded public Allen dataset and export original, compact plotting inputs.

Requires Python >=3.12, numpy and h5py (see the project requirements-data.txt). No AllenSDK code is bundled.
Default output: examples/neural-populations/data/allen. The 85 MB upstream HDF5 stays in a temp cache.
The script reads only official public resources; it does not access Flux state.
"""
import argparse, csv, hashlib, io, json, pathlib, pickle, shutil, tempfile, urllib.request
import h5py
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / 'data/allen'
if not (DATA_ROOT / 'provenance.json').exists():
    DATA_ROOT = ROOT / 'examples/neural-populations/data/allen'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=pathlib.Path, default=DATA_ROOT)
parser.add_argument('--cache', type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()) / 'flux-neural-public-data')
parser.add_argument('--verify', action='store_true', help='Check exported file hashes without network access')
args = parser.parse_args()
out = args.output.resolve()
manifest_path = DATA_ROOT / 'provenance.json'
manifest = json.loads(manifest_path.read_text())

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

if args.verify:
    for entry in manifest['files']:
        path = out / entry['path']
        assert path.is_file(), f'Missing {path}'
        assert sha(path) == entry['sha256'], f'Changed file: {path}'
    print(f"Verified {len(manifest['files'])} public-data files")
    raise SystemExit(0)

out.mkdir(parents=True, exist_ok=True)
args.cache.mkdir(parents=True, exist_ok=True)

def fetch(url, destination, expected):
    if destination.exists():
        if sha(destination) != expected:
            raise RuntimeError(f'Refusing to overwrite changed file: {destination}')
        return
    partial = destination.with_suffix(destination.suffix + '.download')
    with urllib.request.urlopen(url, timeout=60) as response, partial.open('wb') as stream:
        if int(response.headers.get('Content-Length', 0)) > 100_000_000:
            raise RuntimeError('Upstream file exceeds the 100 MB acquisition bound')
        total = 0
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > 100_000_000:
                raise RuntimeError('Upstream file exceeds the 100 MB acquisition bound')
            stream.write(chunk)
    if sha(partial) != expected:
        partial.unlink()
        raise RuntimeError(f'Upstream checksum changed: {url}')
    partial.replace(destination)

source = manifest['functional_source']
source_path = args.cache / '501940850-analysis.h5'
fetch(source['download_url'], source_path, source['sha256'])
for entry in manifest['files']:
    if entry.get('download_url'):
        fetch(entry['download_url'], out / entry['path'], entry['sha256'])

# Old upstream HDF5 tables store object arrays as pickles. Allow only NumPy's
# numeric-array constructors, never arbitrary classes from downloaded data.
class Safe(pickle.Unpickler):
 def find_class(self,module,name):
  allowed={('numpy.core.multiarray','_reconstruct'):np._core.multiarray._reconstruct,('numpy','ndarray'):np.ndarray,('numpy','dtype'):np.dtype,('numpy.core.multiarray','scalar'):np._core.multiarray.scalar}
  if (module,name) in allowed:return allowed[(module,name)]
  raise ValueError((module,name))
def clean(v):
 if isinstance(v,np.ndarray):return clean(v.tolist())
 if isinstance(v,(list,tuple)):return [clean(x) for x in v]
 if isinstance(v,dict):return {k:clean(x) for k,x in v.items()}
 if isinstance(v,(np.integer,int)):return int(v)
 if isinstance(v,(np.floating,float)):return round(float(v),6) if np.isfinite(v) else None
 return v
with h5py.File(source_path, 'r') as f:
 def table(key):
  g=f['analysis/'+key];result={}
  for k in [x for x in g.keys() if x.endswith('_items')]:
   a=g[k.replace('_items','_values')]
   values=Safe(io.BytesIO(bytes(a[0]))).load() if a.dtype.kind=='O' else a[...]
   for i,c in enumerate(g[k][...]):result[c.decode()]=values[:,i]
  return result
 peak=table('peak');stim=table('stim_table_dg');means=table('mean_sweep_response_dg');sweeps=table('sweep_response_dg')
 ids=peak['cell_specimen_id'];n=len(ids);assert n==143 and len(stim['orientation'])==628
 ori=[0,45,90,135,180,225,270,315];tf=sorted(set(stim['temporal_frequency'])-{0.0});resp=f['analysis/response_dg'][...]
 data={'dataset':'Allen Brain Observatory Visual Coding 2-photon','experiment_id':501940850,'region':'VISl','cell_specimen_ids':ids,'directions_deg':ori,'temporal_frequencies_hz':tf,'response_axes':['direction','temporal_frequency','cell'],'mean_response_pct':resp[:,1:,:n,0],'sem_response_pct':resp[:,1:,:n,1], 'signal_correlation':f['analysis/signal_corr_dg'][...], 'representational_similarity':f['analysis/rep_similarity_dg'][...], 'metrics':{k:peak[k] for k in ['osi_dg','dsi_dg','peak_dff_dg','reliability_dg','cv_os_dg','cv_ds_dg','tf_index_dg','run_modulation_dg','response_reliability_nm1','response_reliability_nm3']}}
 (out/'responses.json').write_text(json.dumps(clean(data),separators=(',',':'),allow_nan=False)+'\n')
 rows=[]
 for i in range(len(stim['orientation'])):
  rows.append({'trial_index':i,**{k:clean(stim[k][i]) for k in stim},'running_speed_cm_s':clean(means['dx'][i]),'responses_pct':[clean(means[str(c)][i]) for c in range(n)]})
 (out/'trials.json').write_text(json.dumps({'cell_specimen_ids':clean(ids),'trials':rows},separators=(',',':'),allow_nan=False)+'\n')
 traces=[]
 for o in ori:
  sel=np.where((stim['orientation']==o)&(stim['temporal_frequency']==2))[0]
  arr=np.array([[sweeps[str(c)][i] for c in range(n)] for i in sel],dtype=float)
  traces.append(np.nanmean(arr,axis=0))
 (out/'traces.json').write_text(json.dumps(clean({'experiment_id':501940850,'directions_deg':ori,'temporal_frequency_hz':2,'cell_specimen_ids':ids,'axes':['direction','cell','sample'],'sample_frames_relative_to_onset':np.arange(120)-30,'approximate_seconds_relative_to_onset':(np.arange(120)-30)/30,'timing_note':'Approximate time axis at nominal 30 Hz. Native source retains 120 samples spanning 30 frames before onset, 60 stimulus frames, 30 after.','mean_trial_trace_pct':traces}),separators=(',',':'),allow_nan=False)+'\n')
 with (out/'cell-metrics.csv').open('w') as h:
  fields=['cell_specimen_id','ori_dg','tf_dg','osi_dg','dsi_dg','peak_dff_dg','reliability_dg','cv_os_dg','cv_ds_dg','tf_index_dg','run_modulation_dg','response_reliability_nm1','response_reliability_nm3'];w=csv.DictWriter(h,fieldnames=fields);w.writeheader();w.writerows([{k:clean(peak[k][i]) for k in fields} for i in range(n)])
 print('cells',n,'directions',ori,'TF',tf,'trials',len(rows));print({p.name:p.stat().st_size for p in out.glob('*')})

# Preserve the reviewed metadata and attribution in standalone exports.
canonical = DATA_ROOT
if out != canonical.resolve():
    for name in ['experiment-metadata.json', 'morphology-metadata.json', 'README.md', 'sources.bib', 'provenance.json']:
        shutil.copyfile(canonical / name, out / name)
