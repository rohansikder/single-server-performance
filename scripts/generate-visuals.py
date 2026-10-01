"""Render checked-in charts and dashboard data from measured k6 summaries."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs/assets'
ASSETS.mkdir(exist_ok=True)
MODES = [('baseline', 'Baseline'), ('node-cache', 'Node cache'), ('nginx-cache', 'Nginx microcache')]
data = []
for key, name in MODES:
    m = json.loads((ROOT / f'docs/smoke-results/{key}.json').read_text())['metrics']
    data.append(dict(key=key, name=name, rps=m['http_reqs']['rate'], requests=m['http_reqs']['count'], median=m['http_req_duration']['med'], p95=m['http_req_duration']['p(95)'], p99=m['http_req_duration']['p(99)'], errorRate=m['http_req_failed']['value']))
journeys = []
for key in ['journey-default-lock', 'journey']:
    m = json.loads((ROOT / f'docs/smoke-results/{key}.json').read_text())['metrics']
    journeys.append(dict(key=key, p95=m['http_req_duration']['p(95)'], requests=m['http_reqs']['count']))
payload = dict(modes=data, journeys=journeys, protocol=dict(vus=20, durationSeconds=15, seedUsers=50000, seedPosts=500000, seedLikes=2000000, kind='Single feed smoke runs', generator='Same managed host', cpuBudget=1))
(ROOT / 'docs/assets/benchmark-data.json').write_text(json.dumps(payload, indent=2) + '\n')
template = (ROOT / 'docs/dashboard.template.html').read_text()
(ROOT / 'docs/dashboard.html').write_text(template.replace('__BENCHMARK_DATA__', json.dumps(payload)))

BG, PANEL, TEXT, MUTED = '#101821', '#19232e', '#ecf1f5', '#afbecd'
COLORS = ['#9fb0c5', '#ffb18a', '#7ee0c2']
plt.rcParams.update({'figure.facecolor':BG, 'axes.facecolor':PANEL, 'axes.edgecolor':PANEL, 'text.color':TEXT, 'axes.labelcolor':MUTED, 'xtick.color':MUTED, 'ytick.color':MUTED, 'font.family':'DejaVu Sans', 'font.size':11, 'svg.fonttype':'none', 'svg.hashsalt':'single-server-performance'})

def style(ax):
    for s in ax.spines.values(): s.set_visible(False)
    ax.grid(axis='y', alpha=.10, color=TEXT)
    ax.set_axisbelow(True)
    ax.tick_params(length=0)

def save(fig, name):
    fig.savefig(ASSETS/f'{name}.svg', facecolor=BG, bbox_inches='tight', metadata={'Date': None})
    fig.savefig(ASSETS/f'{name}.png', facecolor=BG, bbox_inches='tight', dpi=180)
    plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
fig.subplots_adjust(top=.75, bottom=.25, wspace=.30)
fig.text(.07, .93, 'ONE SERVER. THREE RESPONSE PATHS.', color=COLORS[2], fontsize=10, weight='bold')
fig.text(.07, .85, 'Measured feed performance', fontsize=24, weight='bold')
for ax, metric, title, unit in [(axes[0], 'rps', 'Throughput · higher is better', 'requests / second'), (axes[1], 'median', 'Median latency · lower is better', 'milliseconds')]:
    style(ax)
    values = [d[metric] for d in data]
    bars = ax.bar(range(3), values, color=COLORS, width=.5)
    ax.set_xticks(range(3), [d['name'] for d in data], fontsize=10)
    ax.set_title(title, loc='left', pad=18, fontsize=12)
    ax.set_ylabel(unit)
    ax.set_ylim(0, max(values)*1.3)
    for bar, v in zip(bars, values): ax.text(bar.get_x()+bar.get_width()/2, v+max(values)*.04, f'{v:,.2f}', ha='center', fontsize=12, weight='bold')
fig.text(.07,.13,'20 VUs  /  15 seconds per mode  /  0 HTTP failures  /  seeded PostgreSQL dataset',color=MUTED,fontsize=10)
fig.text(.07,.075,'Single smoke runs on a shared host; no dedicated warm-up. These are not cloud capacity estimates.',color=MUTED,fontsize=10)
save(fig,'performance-overview')

fig, ax = plt.subplots(figsize=(13,5.3))
fig.subplots_adjust(top=.72, bottom=.24)
fig.text(.07,.92,'THE WHOLE LATENCY PICTURE',color=COLORS[2],fontsize=10,weight='bold')
fig.text(.07,.83,'Median improved. Tail latency did not.',fontsize=23,weight='bold')
style(ax)
x=np.arange(3)
for j,(metric,label) in enumerate([('median','Median'),('p95','p95'),('p99','p99')]):
    bars=ax.bar(x+(j-1)*.23,[d[metric] for d in data],width=.20,color=COLORS[j],label=label)
    for b,d in zip(bars,data): ax.text(b.get_x()+b.get_width()/2,b.get_height()+2,f'{d[metric]:.1f}',ha='center',fontsize=9)
ax.set_xticks(x,[d['name'] for d in data]); ax.set_ylabel('milliseconds'); ax.set_ylim(0,135)
ax.legend(frameon=False,labelcolor=TEXT,loc='upper left',ncol=3)
fig.text(.07,.12,'Single 15-second feed smoke runs at 20 VUs. Short-run variability and CPU quotas affect the tails.',color=MUTED,fontsize=10)
fig.text(.07,.06,'All three runs passed p95 < 500 ms, p99 < 1,000 ms and HTTP failure rate < 1%.',color=MUTED,fontsize=10)
save(fig,'latency-comparison')

fig,ax=plt.subplots(figsize=(13,5.5)); ax.set_xlim(0,13);ax.set_ylim(0,5);ax.axis('off')
fig.text(.07,.93,'ARCHITECTURE / CONCEPTUAL RESPONSE PATHS',color=COLORS[2],fontsize=10,weight='bold')
fig.text(.07,.85,'Move the cache closer to the request.',fontsize=23,weight='bold')
for y,label,active in [(3.5,'Baseline',None),(2.25,'Node cache',2),(1,'Nginx microcache',1)]:
    ax.text(.05,y,label,va='center',color=TEXT,fontsize=11,weight='bold')
    for i,(name,detail) in enumerate([('k6','load generator'),('Nginx','reverse proxy'),('Node.js','API + JSON'),('PostgreSQL','indexed feed')]):
        px=2.7+i*2.5
        fill=COLORS[2] if i==active else PANEL
        edge=COLORS[2] if i==active else '#334353'
        ax.add_patch(FancyBboxPatch((px,y-.38),2,.8,boxstyle='round,pad=.03,rounding_size=.09',facecolor=fill,edgecolor=edge))
        ax.text(px+1,y+.08,name,ha='center',va='center',color=BG if i==active else TEXT,fontsize=11,weight='bold')
        ax.text(px+1,y-.15,'cache HIT → respond' if i==active else detail,ha='center',color=BG if i==active else MUTED,fontsize=8)
        if i<3:
            passed=active is None or i<active
            ax.add_patch(FancyArrowPatch((px+2.05,y),(px+2.4,y),arrowstyle='->',mutation_scale=14,color=COLORS[2] if passed else '#536272',linestyle='-' if passed else '--'))
fig.text(.07,.10,'Cache misses continue upstream. Only the shared public feed is cached; reads and writes use the API.',color=MUTED,fontsize=10)
fig.text(.07,.045,'Node TTL: 1 second + write invalidation. Nginx: 1-second TTL, whole-second expiry, 100 ms cache-lock wait budget.',color=MUTED,fontsize=9)
save(fig,'architecture')
print('Generated dashboard, benchmark data, and six SVG/PNG chart artifacts from raw k6 summaries.')
