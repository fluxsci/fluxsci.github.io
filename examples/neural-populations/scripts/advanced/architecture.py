#!/usr/bin/env python3
"""Additional original network and cell-architecture plots from public Allen data."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection, PolyCollection
from matplotlib.colors import LinearSegmentedColormap, to_rgb
from matplotlib.patches import Arc
import fluxplot as fp

PROJECT=Path(__file__).resolve().parents[2]
fx=fp.style
fx.use_light()
INK='#100f0f'
COLORS=[fx.FLEXOKI[k] for k in ('blue','cyan','green','yellow','orange','red','magenta','purple')]


def save(fig, stem, description, inputs, output, preview, records):
    output.mkdir(parents=True,exist_ok=True);preview.mkdir(parents=True,exist_ok=True)
    svg=output/f'{stem}.svg'
    if len(fig.axes) != 1:
        raise ValueError('Each SVG must contain exactly one matplotlib axis.')
    with plt.rc_context({'figure.constrained_layout.use':False}):
        result=fp.save(fig,str(svg),force_vectors=True,recipe={'script':__file__,'params':{},'inputs':[str(PROJECT/'data/allen'/p) for p in inputs]})
    if result is None or getattr(result,'skipped',False):
        inventory=output/'architecture-inventory.json'
        if inventory.exists():
            records.extend(r for r in json.loads(inventory.read_text()) if r['id']==stem)
        plt.close(fig)
        return
    rp=svg.with_suffix('.recipe.json');r=json.loads(rp.read_text())
    r.update(command='uv',cwd='../..',args=['run','--project','scripts/advanced','python','scripts/advanced/architecture.py'],script={'path':'scripts/advanced/architecture.py'})
    for entry in r.get('inputs',[]):entry['path']='data/allen/'+Path(entry['path']).name
    rp.write_text(json.dumps(r,indent=2)+'\n')
    fig.savefig(preview/f'{stem}.png',dpi=400)
    fig.savefig(preview/f'{stem}.pdf')
    records.append({'id':stem,'svg':f'plots/advanced/{stem}.svg','preview':f'exports/advanced-previews/{stem}.png','description':description,'sourceFiles':['data/allen/'+p for p in inputs],'morphSuitable':False,'axesCount':len(fig.axes),'widthIn':float(fig.get_size_inches()[0]),'heightIn':float(fig.get_size_inches()[1]),'sha256':hashlib.sha256(svg.read_bytes()).hexdigest()})
    plt.close(fig)
    print(stem,flush=True)


def network(output,preview,records):
    data=json.loads((PROJECT/'data/allen/responses.json').read_text())
    responses=np.asarray(data['mean_response_pct'],float)
    profiles=np.maximum(np.nan_to_num(responses),0).mean(axis=1)
    preferred=np.argmax(profiles,axis=0)
    peak=profiles.max(axis=0)
    corr=np.asarray(data['signal_correlation'],float)
    corr=np.nan_to_num(corr)
    # The common circular ordering is by measured preferred direction, then response
    # weighted direction center within each bin. Edges use measured signal correlations.
    theta=np.deg2rad(np.asarray(data['directions_deg']))
    angle=np.angle(np.sum(profiles*np.exp(1j*theta[:,None]),axis=0))
    ordering=np.lexsort((angle,preferred))
    n=len(ordering);gap=.045;span=(2*np.pi-8*gap)/n
    xy=np.zeros((n,2)); node_angles=np.zeros(n)
    groups=[];cursor=np.pi/2
    for direction in range(8):
        group=[int(i) for i in ordering if preferred[i]==direction]
        begin=cursor
        for i in group:
            a=cursor-span/2;node_angles[i]=a;xy[i]=[np.cos(a),np.sin(a)];cursor-=span
        groups.append((direction,begin,cursor,group));cursor-=gap
    edges=[]
    # Keep all strong response-profile correlations, not selected aesthetic links.
    for i in range(n):
        for j in range(i+1,n):
            if corr[i,j]>=.60:edges.append((i,j,float(corr[i,j])))
    edges.sort(key=lambda e:e[2])
    curves=[];edge_colors=[];widths=[]
    t=np.linspace(0,1,32)[:,None]
    for i,j,r in edges:
        p0,p3=xy[i]*.97,xy[j]*.97
        # Cubic Bézier geometry only controls the layout; correlations remain unchanged.
        same=preferred[i]==preferred[j]
        radial=.58 if same else .16
        p1,p2=p0*radial,p3*radial
        curves.append((1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3)
        color=np.mean([to_rgb(COLORS[preferred[i]]),to_rgb(COLORS[preferred[j]])],axis=0)
        edge_colors.append((*color,.26+.36*(r-.6)/.4))
        widths.append(.18+.40*(r-.6)/.4)
    fig,ax=plt.subplots(1,1,figsize=(3.35,3.45),layout='none');fig.subplots_adjust(left=.04,right=.96,top=.97,bottom=.10)
    col=LineCollection(curves,colors=edge_colors,linewidths=widths,capstyle='round')
    ax.add_collection(col);fp.tag(col,role='x-response-similarity',series='measured-response-links')
    sizes=4+13*np.sqrt(np.minimum(peak,np.quantile(peak,.95))/np.quantile(peak,.95))
    for direction,start,end,group in groups:
        if not group:continue
        points=fp.scatter(ax,xy[group,0],xy[group,1],series=f'preference-{direction*45}',s=sizes[group],color=COLORS[direction],edgecolors='white',linewidths=.3,zorder=5)
        arc=Arc((0,0),2.13,2.13,theta1=np.rad2deg(end),theta2=np.rad2deg(start),edgecolor=COLORS[direction],linewidth=2.2,capstyle='butt')
        ax.add_patch(arc);fp.tag(arc,role='x-preference-sector',series=f'sector-{direction*45}')
        a=(start+end)/2
        ax.text(1.19*np.cos(a),1.19*np.sin(a),f'{direction*45}°',fontsize=6,color=COLORS[direction],ha='center',va='center')
    ax.set_aspect('equal');ax.set_xlim(-1.27,1.27);ax.set_ylim(-1.23,1.26);ax.set_axis_off()
    fig.text(.05,.025,f'{n} cells · {len(edges)} links · signal r ≥ 0.60',fontsize=6,color=INK)
    fig.text(.95,.025,'Preferred drift direction',fontsize=5,ha='right',color='#6f6e69')
    save(fig,'19-response-architecture',
         'Circular response-similarity graph for all 143 measured cells. Cells grouped by preferred drift direction (positive mean response across temporal frequencies); all measured signal correlations ≥0.60 are shown. Node area scales with the square root of peak direction response, winsorized at the 95th percentile. Layout is illustrative; edges are not synapses.',
         ['responses.json'],output,preview,records)


def arbor(output,preview,records):
    source='cell-480114344.swc'
    data=np.loadtxt(PROJECT/'data/allen'/source,comments='#')
    by_id={int(r[0]):r for r in data};soma=data[data[:,1]==1][0]
    distance={int(soma[0]):0.}
    def path_distance(i):
        if i in distance:return distance[i]
        r=by_id[i];p=int(r[6])
        if p not in by_id:distance[i]=0.
        else:distance[i]=path_distance(p)+float(np.linalg.norm(r[2:5]-by_id[p][2:5]))
        return distance[i]
    # Iterative parent traversal avoids a recursion-depth assumption for dense SWCs.
    for i in by_id:
        chain=[];cur=i
        while cur not in distance and cur in by_id:
            chain.append(cur);cur=int(by_id[cur][6])
        for j in reversed(chain):path_distance(j)
    segments=[];values=[];radii=[]
    for r in data:
        p=by_id.get(int(r[6]))
        if p is None:continue
        segments.append([r[2:4]-soma[2:4],p[2:4]-soma[2:4]])
        values.append((distance[int(r[0])]+distance[int(p[0])])/2)
        radii.append(max(float(r[5]),.1))
    segments=np.asarray(segments);values=np.asarray(values);radii=np.asarray(radii)
    # Dark proximal navy → teal → gold distal branches, all keyed to actual path length.
    cmap=LinearSegmentedColormap.from_list('arbor-distance',['#163b61','#246e86','#349b91','#86b68b','#d2a95c','#bd613c'])
    fig,ax=plt.subplots(1,1,figsize=(3.35,3.5),layout='none');fig.subplots_adjust(left=.04,right=.96,bottom=.18,top=.98)
    limits=[segments[:,:,0].min(),segments[:,:,0].max(),segments[:,:,1].min(),segments[:,:,1].max()]
    widths=np.clip(.20+.34*np.sqrt(radii),.28,1.45)
    col=LineCollection(segments,colors=cmap(values/max(values.max(),1)),linewidths=widths,capstyle='round',joinstyle='round')
    ax.add_collection(col);fp.tag(col,role='x-neuron-arbor',series='reconstructed-arbor')
    fp.scatter(ax,[0],[0],series='soma',s=13,color='#163b61',edgecolors='white',linewidths=.35,zorder=4)
    ax.set_aspect('equal');ax.set_xlim(limits[0]-22,limits[1]+22);ax.set_ylim(limits[2]-25,limits[3]+22);ax.set_axis_off()
    # The scale bar is in physical SWC coordinates, in a reserved lower corner.
    x0,y0=limits[1]-95,limits[2]-10
    ax.plot([x0,x0+50],[y0,y0],color=INK,lw=1.3,solid_capstyle='butt')
    ax.text(x0+25,y0+12,'50 μm',ha='center',va='bottom',fontsize=6)
    # Compact color key drawn on the same axes in axes coordinates; no second axis.
    key_quads=[]
    for j in range(100):
        x1=.22+.56*j/100; x2=.22+.56*(j+1)/100
        key_quads.append([(x1,-.083),(x2,-.083),(x2,-.067),(x1,-.067)])
    key=PolyCollection(key_quads,facecolors=cmap(np.linspace(0,1,100)),edgecolors='face',linewidths=.02,antialiaseds=False,transform=ax.transAxes,clip_on=False)
    ax.add_collection(key)
    fp.tag(key,role='x-path-distance-key',series='path-distance-key')
    maxdist=values.max()
    ax.text(.22,-.12,'0',transform=ax.transAxes,ha='center',fontsize=5)
    ax.text(.78,-.12,f'{maxdist:.0f} μm',transform=ax.transAxes,ha='center',fontsize=5)
    ax.text(.50,-.17,'Path distance from soma',transform=ax.transAxes,ha='center',fontsize=6)
    save(fig,'20-dendritic-arbor',
         'A single original rendering of Allen Cell Types specimen 480114344 (Rorb). Actual SWC x/y coordinates, topology and radii are retained. Color is cumulative 3D path distance along the reconstruction from the soma; visible width is a square-root mapping of recorded radius for legibility. This anatomical specimen is independent of the 143-cell imaging experiment.',
         [source],output,preview,records)


def main():
    global PROJECT
    parser=argparse.ArgumentParser();parser.add_argument('--project',type=Path,default=PROJECT);args=parser.parse_args()
    PROJECT=args.project.resolve()
    output=PROJECT/'plots/advanced';preview=PROJECT/'exports/advanced-previews';records=[]
    network(output,preview,records);arbor(output,preview,records)
    (output/'architecture-inventory.json').write_text(json.dumps(records,indent=2)+'\n')
if __name__=='__main__':main()
