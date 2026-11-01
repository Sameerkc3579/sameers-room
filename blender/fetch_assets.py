"""Downloads the CC0 Poly Haven assets the room uses into blender/assets/ (not shipped; only the baked glb is).

  python blender/fetch_assets.py

Everything here is CC0 (https://polyhaven.com/license), credited in CREDITS.md anyway.
"""

import json
import os
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
API = 'https://api.polyhaven.com/files/'
UA = {'User-Agent': 'sameer-portfolio-room/1.0'}

MODELS = [
    'potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'anthurium_botany_01', 'calathea_orbifolia_01',
    'pachira_aquatica_01', 'desk_lamp_arm_01', 'vintage_radio_transceiver', 'cassette_player', 'Television_01',
    'binder_notebook', 'book_encyclopedia_set_01', 'office_notepads',
    'stationery_supplies', 'vintage_stapler', 'alarm_clock_01', 'standing_picture_frame_01',
    'hanging_picture_frame_01', 'hanging_picture_frame_02', 'drawer_cabinet', 'cardboard_box_01',
    'modern_arm_chair_01', 'ceramic_vase_01',
    # sage room (2026-11-01)
    'ceramic_vase_02', 'ceramic_vase_03', 'standing_picture_frame_02', 'fern_02',
]
TEXTURES = ['beige_wall_001', 'wood_floor_worn', 'wood_table_001', 'oak_veneer_02', 'walnut_veneer',
            'white_plaster_02', 'oak_veneer_01', 'rough_linen', 'dirty_carpet']
TEX_MAPS = {'Diffuse': 'diff', 'nor_gl': 'nor', 'Rough': 'rough'}
HDRIS = ['sunset_jhbcentral', 'green_sanctuary']


def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req) as r, open(dest + '.part', 'wb') as f:
        f.write(r.read())
    os.replace(dest + '.part', dest)


def info(asset):
    with urllib.request.urlopen(urllib.request.Request(API + asset, headers=UA)) as r:
        return json.load(r)


def fetch_model(name, res='1k'):
    g = info(name)['gltf'][res]['gltf']
    base = os.path.join(ROOT, 'models', name)
    get(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, f in g.get('include', {}).items():
        get(f['url'], os.path.join(base, rel))


def fetch_texture(name, res='1k'):
    d = info(name)
    for key, short in TEX_MAPS.items():
        get(d[key][res]['jpg']['url'], os.path.join(ROOT, 'textures', name, f'{short}.jpg'))


def fetch_hdri(name):
    d = info(name)
    get(d['hdri']['1k']['hdr']['url'], os.path.join(ROOT, 'hdri', f'{name}_1k.hdr'))
    get(d['tonemapped']['url'], os.path.join(ROOT, 'hdri', f'{name}_full.jpg'))


if __name__ == '__main__':
    for i, m in enumerate(MODELS, 1):
        print(f'[{i}/{len(MODELS)}] model {m}', flush=True)
        try:
            fetch_model(m)
        except Exception as e:  # keep going; the build script skips missing models
            print('   failed:', e, file=sys.stderr)
    for t in TEXTURES:
        print('texture', t, flush=True)
        fetch_texture(t)
    for h in HDRIS:
        print('hdri', h, flush=True)
        fetch_hdri(h)
    print('done')
