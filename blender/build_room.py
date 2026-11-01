"""Builds the sage desk nook (after Sameer's reference photo) and exports it as a glb for the web scene.

  python blender/fetch_assets.py   # once: CC0 models/textures/HDRIs from Poly Haven
  python blender/make_art.py       # once: quote cards, leaf prints, pegboard texture
  blender -b -P blender/build_room.py -- --out ../blender/room_raw.glb      (or: cd scene && npm run room)

Layout (metres, three.js axes; origin = floor under the middle of the desk's front edge):
  back wall z = -0.75 with two floating oak shelves (LED strips under them) and a pegboard on the right;
  left wall x = -1.5 with a window (blinds, plants on the sill); desk along the back wall; chair in front.
Names the web scene relies on: Screen, Monitor, Keyboard, Books, Headphones, Quote_Frame, Notebooks,
Mushroom_Lamp, LED_Upper, LED_Lower, Neon, DeskClock_Screen, Glass_*, and the empties Candle_*,
Lamp_Light, Mist_Origin.
"""
import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)
import roomkit as K  # noqa: E402  (needs the empty scene first)
from roomkit import art, ball, box, cyl, empty, join, mat, pbr, place, plane, span, tube  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='blender/room_raw.glb')
ap.add_argument('--blend', default='blender/room.blend')
args = ap.parse_args(argv)
rnd = random.Random(7)

# ================================================================ materials
M = dict(
    plaster=pbr('Plaster', 'white_plaster_02'),
    oak=pbr('Oak', 'oak_veneer_01'),
    carpet=pbr('Carpet', 'dirty_carpet'),
    linen=pbr('Linen', 'rough_linen'),
    paint=mat('WhitePaint', '#eeebe4', 0.55),
    sage=mat('SagePlastic', '#8fa585', 0.45),
    sage_dark=mat('SageDark', '#6d8763', 0.5),
    sage_light=mat('SageLight', '#b7c9ab', 0.5),
    keycap=mat('KeycapCream', '#ece6d6', 0.45),
    kb_base=mat('KeyboardBase', '#7f9877', 0.4),
    silver=mat('Silver', '#c9ccd0', 0.3, 0.9),
    black=mat('BlackPlastic', '#141516', 0.4),
    glass=mat('Glass', '#e8f0f4', 0.05),
    wax=mat('Wax', '#f3ead8', 0.6),
    flame=mat('Flame', '#ffcf7a', 0.5, emit='#ffb347', strength=8),
    led=mat('LedStrip', '#ffe2b8', 0.5, emit='#ffc178', strength=6),
    neon=mat('NeonTube', '#fff6e0', 0.3, emit='#fff1cf', strength=9),
    lamp_glow=mat('LampGlow', '#fff3dc', 0.5, emit='#ffd9a0', strength=5),
    leaf1=mat('LeafDark', '#3f6a33', 0.45),
    leaf2=mat('LeafMid', '#5a8a40', 0.45),
    leaf3=mat('LeafLight', '#78a552', 0.45),
    stem=mat('Stem', '#5d7a3c', 0.6),
    petal=mat('Petal', '#f4efe2', 0.55),
    ceramic=mat('CeramicSage', '#9db58f', 0.35),
    clock_screen=mat('ClockScreen', '#1d241c', 0.3),
    mirror=mat('Mirror', '#dfe3e6', 0.04, 1.0),
    cushion=mat('Cushion', '#e9e4d8', 0.8),
    paper=mat('Paper', '#f4efe2', 0.85),
    cover1=mat('CoverSage', '#7d9a72', 0.7),
    cover2=mat('CoverCream', '#e8dfcc', 0.7),
    cover3=mat('CoverMint', '#b9cdb0', 0.7),
    tumbler=mat('TumblerWhite', '#f1efea', 0.35),
    chair_frame=mat('ChairWhite', '#efeeea', 0.35),
    dark_metal=mat('DarkMetal', '#2b2c30', 0.4, 0.7),
    wall=mat('WallPaint', '#efe5d5', 0.92),
    fabric=mat('ChairFabric', '#a9bd9c', 0.95),
    felt=mat('FeltMat', '#dccaa9', 0.95),
)
P = 1.4  # plaster repeat (m)

# ================================================================ shell
H = 2.7
WALL_Z, LW, RW, BACK = -0.75, -1.5, 1.95, 2.6
WIN_Z0, WIN_Z1, WIN_Y0, WIN_Y1 = -0.62, 0.42, 0.98, 2.28
TW = 0.16

span('Floor', M['carpet'], LW - TW, RW, -0.03, 0, WALL_Z - TW, BACK, collection='Room', bevel=0, uv=1.5,
     tint='#6e655c')
span('Ceiling', M['wall'], LW - TW, RW, H, H + 0.04, WALL_Z - TW, BACK, collection='Room', bevel=0)
span('Wall_Back', M['wall'], LW - TW, RW, 0, H, WALL_Z - TW, WALL_Z, collection='Room', bevel=0)
span('Wall_Right', M['wall'], RW, RW + 0.1, 0, H, WALL_Z, BACK, collection='Room', bevel=0)
# left wall, with the window opening
for nm, (y0, y1, z0, z1) in {
    'Bottom': (0, WIN_Y0, WALL_Z, BACK), 'Top': (WIN_Y1, H, WALL_Z, BACK),
    'Back': (WIN_Y0, WIN_Y1, WALL_Z, WIN_Z0), 'Front': (WIN_Y0, WIN_Y1, WIN_Z1, BACK),
}.items():
    span(f'Wall_Left_{nm}', M['wall'], LW - TW, LW, y0, y1, z0, z1, collection='Room', bevel=0)
span('Skirting_Back', M['paint'], LW, RW, 0, 0.07, WALL_Z, WALL_Z + 0.012, collection='Room', bevel=0.002)
span('Skirting_Left', M['paint'], LW, LW + 0.012, 0, 0.07, WALL_Z, BACK, collection='Room', bevel=0.002)

# ---------------------------------------------------------------- window (white frame, blinds, deep sill)
fw = 0.05
wx0 = LW - TW
for nm, (y0, y1, z0, z1) in {
    'T': (WIN_Y1 - fw, WIN_Y1, WIN_Z0, WIN_Z1), 'B': (WIN_Y0, WIN_Y0 + fw, WIN_Z0, WIN_Z1),
    'L': (WIN_Y0, WIN_Y1, WIN_Z0, WIN_Z0 + fw), 'R': (WIN_Y0, WIN_Y1, WIN_Z1 - fw, WIN_Z1),
    'M': (WIN_Y0, WIN_Y1, (WIN_Z0 + WIN_Z1) / 2 - 0.025, (WIN_Z0 + WIN_Z1) / 2 + 0.025),
    'H': (1.62, 1.66, WIN_Z0, WIN_Z1),
}.items():
    span(f'Win_Frame_{nm}', M['paint'], wx0, wx0 + 0.09, y0, y1, z0, z1, collection='Window', bevel=0.003)
for nm, (z0, z1, y0, y1) in {'Back': (WIN_Z0 - 0.004, WIN_Z0, WIN_Y0, WIN_Y1), 'Front': (WIN_Z1, WIN_Z1 + 0.004, WIN_Y0, WIN_Y1)}.items():
    span(f'Win_Reveal_{nm}', M['paint'], wx0 + 0.09, LW, y0, y1, z0, z1, collection='Window', bevel=0)
span('Win_Reveal_Top', M['paint'], wx0 + 0.09, LW, WIN_Y1, WIN_Y1 + 0.004, WIN_Z0, WIN_Z1, collection='Window', bevel=0)
plane('Glass_Window', M['glass'], (wx0 + 0.04, (WIN_Y0 + WIN_Y1) / 2, (WIN_Z0 + WIN_Z1) / 2),
      WIN_Z1 - WIN_Z0, WIN_Y1 - WIN_Y0, facing='+x', collection='Window')
SILL_Y = WIN_Y0
span('Sill', M['paint'], wx0 + 0.09, LW + 0.2, SILL_Y - 0.03, SILL_Y, WIN_Z0 - 0.08, WIN_Z1 + 0.08, collection='Window',
     bevel=0.005)
# venetian blind, half lowered, slats tilted open
blind = [span('Blind_Rail', M['paint'], LW - 0.05, LW + 0.02, WIN_Y1 - 0.05, WIN_Y1, WIN_Z0 + 0.01, WIN_Z1 - 0.01,
              collection='Window', bevel=0.003)]
y = WIN_Y1 - 0.07
while y > 1.64:
    blind.append(box(f'Slat_{y:.3f}', M['paint'], (LW - 0.015, y, (WIN_Z0 + WIN_Z1) / 2),
                     (0.025, 0.0015, WIN_Z1 - WIN_Z0 - 0.03), collection='Window', bevel=0, rot=(0, 0, 35)))
    y -= 0.024
blind.append(span('Blind_Bottom', M['paint'], LW - 0.03, LW + 0.0, y - 0.01, y + 0.005, WIN_Z0 + 0.01, WIN_Z1 - 0.01,
                  collection='Window', bevel=0.002))
join('Blinds', blind)

# ================================================================ desk
Y = 0.76
DZ0, DZ1 = WALL_Z + 0.02, -0.05
span('Desk_Top', M['oak'], LW + 0.02, 1.25, Y - 0.03, Y, DZ0, DZ1, collection='Desk', bevel=0.004, uv=1.0)
join('Desk_Legs', [
    span('Leg_LF', M['chair_frame'], LW + 0.05, LW + 0.09, 0, Y - 0.03, DZ1 - 0.06, DZ1 - 0.02, collection='Desk', bevel=0.004),
    span('Leg_LB', M['chair_frame'], LW + 0.05, LW + 0.09, 0, Y - 0.03, DZ0 + 0.02, DZ0 + 0.06, collection='Desk', bevel=0.004),
    span('Leg_Rail', M['chair_frame'], LW + 0.05, LW + 0.09, Y - 0.1, Y - 0.06, DZ0 + 0.06, DZ1 - 0.06, collection='Desk', bevel=0.002),
])
# white drawer unit under the right side
DX0, DX1 = 0.62, 1.2
dr = [span('Drawer_Unit', M['paint'], DX0, DX1, 0.02, Y - 0.035, DZ0 + 0.02, DZ1 - 0.02, collection='Desk', bevel=0.004)]
for i, (y0, y1) in enumerate([(0.04, 0.26), (0.28, 0.5), (0.52, 0.71)]):
    dr.append(span(f'Drawer_{i}', M['paint'], DX0 + 0.015, DX1 - 0.015, y0, y1, DZ1 - 0.02, DZ1 - 0.005,
                   collection='Desk', bevel=0.004))
    dr.append(span(f'Drawer_Pull_{i}', M['black'], (DX0 + DX1) / 2 - 0.06, (DX0 + DX1) / 2 + 0.06, y1 - 0.035,
                   y1 - 0.025, DZ1 - 0.006, DZ1 - 0.004, collection='Desk', bevel=0))
join('Drawers', dr)

# ================================================================ shelves + LED strips + pegboard
S1 = (-1.02, 0.86, 2.02)   # x0, x1, y (underside) of the upper shelf
S2 = (-0.62, 0.42, 1.62)
for nm, (x0, x1, y0) in (('Upper', S1), ('Lower', S2)):
    span(f'Shelf_{nm}', M['oak'], x0, x1, y0, y0 + 0.03, WALL_Z, WALL_Z + 0.22, collection='Shelves', bevel=0.003, uv=1.0)
    span(f'LED_{nm}', M['led'], x0 + 0.02, x1 - 0.02, y0 - 0.006, y0, WALL_Z + 0.19, WALL_Z + 0.2, collection='Shelves', bevel=0)

PX0, PX1, PY0, PY1 = 0.55, 1.25, 1.12, 1.96
peg = [
    span('Peg_Back', M['paint'], PX0, PX1, PY0, PY1, WALL_Z, WALL_Z + 0.018, collection='Shelves', bevel=0.003),
    plane('Peg_Face', art('Pegboard', 'pegboard.png', 0.7), ((PX0 + PX1) / 2, (PY0 + PY1) / 2, WALL_Z + 0.0185),
          PX1 - PX0 - 0.01, PY1 - PY0 - 0.01, collection='Shelves'),
    span('Peg_Shelf', M['paint'], PX0 + 0.04, PX1 - 0.04, 1.28, 1.295, WALL_Z + 0.018, WALL_Z + 0.12, collection='Shelves', bevel=0.002),
    span('Peg_Shelf_Lip', M['paint'], PX0 + 0.04, PX1 - 0.04, 1.28, 1.32, WALL_Z + 0.115, WALL_Z + 0.12, collection='Shelves', bevel=0.001),
    span('Peg_Top_Shelf', M['paint'], 0.92, 1.22, PY1, PY1 + 0.015, WALL_Z, WALL_Z + 0.14, collection='Shelves', bevel=0.002),
]
for i, x in enumerate((0.7, 0.86, 1.02)):  # pencil cups
    peg.append(cyl(f'Pencil_Cup_{i}', M['paint'], (x, 1.335, WALL_Z + 0.07), 0.032, 0.08, verts=24))
    for j in range(4):
        c = (M['sage'], M['cover2'], M['sage_dark'], M['black'])[(i + j) % 4]
        peg.append(cyl(f'Pencil_{i}_{j}', c, (x - 0.012 + j * 0.008, 1.41, WALL_Z + 0.07 + (j % 2) * 0.01), 0.004,
                       0.11, verts=8))
join('Pegboard', peg)


def framed(name, image_mat, center, w, h, frame_mat, depth=0.015, border=0.012, tilt=0.0, facing='+z'):
    """A thin picture frame with a print, standing/hanging at `center` (facing the camera unless '+x')."""
    x, y, z = center
    t = math.radians(tilt)
    parts = []
    if facing == '+z':
        parts.append(box(f'{name}_Frame', frame_mat, (x, y, z - depth / 2), (w, h, depth), bevel=0.002, rot=(-tilt, 0, 0)))
        # the print sits on the frame's front face (which leans back by `tilt`)
        parts.append(plane(f'{name}_Art', image_mat, (x, y - depth / 2 * math.sin(t), z + 0.0008 - depth / 2 * (1 - math.cos(t))),
                           w - 2 * border, h - 2 * border, tilt=tilt))
    else:
        parts.append(box(f'{name}_Frame', frame_mat, (x + depth / 2, y, z), (depth, h, w), bevel=0.002))
        parts.append(plane(f'{name}_Art', image_mat, (x + depth + 0.0008, y, z), w - 2 * border, h - 2 * border,
                           facing='+x'))
    return join(name, parts)


# ================================================================ upper shelf
SY1 = S1[2] + 0.03
SZ = WALL_Z + 0.1
framed('Quote_Frame', art('QuoteSoul', 'quote_soul.png'), (-0.28, SY1 + 0.215, WALL_Z + 0.06), 0.32, 0.42, M['oak'], tilt=6)
framed('Shelf_Print', art('LeafPrintA', 'leaf_print_a.png'), (0.02, SY1 + 0.13, WALL_Z + 0.08), 0.17, 0.23, M['paint'], tilt=5)
place('ceramic_vase_01', 'Shelf_Vase', (0.3, SY1, SZ), scale=0.42, tint='#8fae80')
cyl('Candle_Jar_3', M['glass'], (0.48, SY1 + 0.04, SZ), 0.035, 0.08, verts=24)
cyl('Candle_Wax_3', M['wax'], (0.48, SY1 + 0.03, SZ), 0.031, 0.055, verts=24)
cyl('Flame_3', M['flame'], (0.48, SY1 + 0.075, SZ), 0.006, 0.018, verts=8, r_top=0.0005)
empty('Candle_3', (0.48, SY1 + 0.09, SZ))
join('Shelf_Books', [
    box('SB_1', M['cover2'], (0.7, SY1 + 0.012, SZ), (0.2, 0.024, 0.15), bevel=0.002),
    box('SB_2', M['cover1'], (0.705, SY1 + 0.036, SZ), (0.19, 0.024, 0.145), bevel=0.002, rot=(0, 4, 0)),
    box('SB_3', M['cover3'], (0.7, SY1 + 0.058, SZ), (0.17, 0.02, 0.13), bevel=0.002, rot=(0, -3, 0)),
])
ball('Knot_Pillow', M['sage_light'], (0.72, SY1 + 0.11, SZ), (0.06, 0.035, 0.05))
place('potted_plant_02', 'Shelf_Plant', (-0.82, SY1, SZ), scale=0.34, parts=['potted_plant_02_pot', 'potted_plant_02_leaves'], max_tris=9000)

# ================================================================ lower shelf
SY2 = S2[2] + 0.03
lamp = [
    cyl('ML_Base', M['sage'], (-0.47, SY2 + 0.01, SZ), 0.045, 0.02, verts=32, bevel=0.003),
    cyl('ML_Stem', M['sage'], (-0.47, SY2 + 0.08, SZ), 0.012, 0.13, verts=16),
    ball('ML_Shade', M['sage'], (-0.47, SY2 + 0.155, SZ), (0.075, 0.045, 0.075), segs=32),
    ball('ML_Bulb', M['lamp_glow'], (-0.47, SY2 + 0.135, SZ), (0.05, 0.02, 0.05), segs=16),
]
join('Mushroom_Lamp', lamp)
empty('Lamp_Light', (-0.47, SY2 + 0.12, SZ))
mirror = [
    cyl('Mirror_Ring', M['oak'], (-0.27, SY2 + 0.1, WALL_Z + 0.05), 0.095, 0.015, verts=48, axis='z'),
    cyl('Mirror_Glass', M['mirror'], (-0.27, SY2 + 0.1, WALL_Z + 0.058), 0.082, 0.002, verts=48, axis='z'),
]
join('Mirror', mirror)
cyl('Candle_Jar_4', M['glass'], (-0.3, SY2 + 0.035, SZ + 0.05), 0.03, 0.07, verts=24)
cyl('Candle_Wax_4', M['wax'], (-0.3, SY2 + 0.025, SZ + 0.05), 0.027, 0.05, verts=24)
cyl('Flame_4', M['flame'], (-0.3, SY2 + 0.065, SZ + 0.05), 0.005, 0.016, verts=8, r_top=0.0005)
empty('Candle_4', (-0.3, SY2 + 0.08, SZ + 0.05))
framed('Lower_Print', art('LeafPrintB', 'leaf_print_b.png'), (-0.05, SY2 + 0.1, WALL_Z + 0.07), 0.13, 0.17, M['oak'], tilt=5)
place('potted_plant_04', 'Lower_Succulent', (0.17, SY2, SZ), scale=0.75, tint='#c9d8be')
# neon leaf on the wall, right of the lower shelf
NX, NY = 0.27, 1.83
leaf_outline = [(NX, NY - 0.1), (NX - 0.06, NY - 0.04), (NX - 0.07, NY + 0.03), (NX - 0.02, NY + 0.09),
                (NX, NY + 0.1), (NX + 0.02, NY + 0.09), (NX + 0.07, NY + 0.03), (NX + 0.06, NY - 0.04), (NX, NY - 0.1)]
neon = [tube('Neon_Outline', M['neon'], [(x, y, WALL_Z + 0.02) for x, y in leaf_outline], radius=0.004)]
neon.append(tube('Neon_Rib', M['neon'], [(NX, NY - 0.12, WALL_Z + 0.02), (NX, NY + 0.07, WALL_Z + 0.02)], radius=0.003))
for s in (-1, 1):
    for k in range(3):
        yy = NY - 0.05 + k * 0.045
        neon.append(tube(f'Neon_V{s}{k}', M['neon'], [(NX, yy, WALL_Z + 0.02), (NX + s * 0.045, yy + 0.03, WALL_Z + 0.02)],
                         radius=0.0025))
join('Neon', neon)

# ================================================================ desk top
RZ0, RZ1 = WALL_Z + 0.04, -0.47
join('Riser', [
    span('Riser_Top', M['oak'], -0.42, 0.42, Y + 0.1, Y + 0.12, RZ0, RZ1, collection='Desk', bevel=0.003, uv=1.0),
    span('Riser_L', M['oak'], -0.42, -0.4, Y, Y + 0.1, RZ0, RZ1, collection='Desk', bevel=0.002, uv=1.0),
    span('Riser_R', M['oak'], 0.4, 0.42, Y, Y + 0.1, RZ0, RZ1, collection='Desk', bevel=0.002, uv=1.0),
])
RY = Y + 0.12
# books under the riser (clickable: Projects)
join('Books', [
    box('Bk_1', M['cover2'], (-0.2, Y + 0.015, -0.6), (0.26, 0.03, 0.19), bevel=0.003),
    box('Bk_1p', M['paper'], (-0.2, Y + 0.015, -0.505), (0.25, 0.024, 0.002), bevel=0),
    box('Bk_2', M['cover1'], (-0.19, Y + 0.043, -0.6), (0.24, 0.026, 0.18), bevel=0.003, rot=(0, 3, 0)),
    box('Bk_3', M['cover3'], (0.18, Y + 0.014, -0.6), (0.24, 0.028, 0.18), bevel=0.003, rot=(0, -2, 0)),
    box('Bk_4', M['cover2'], (0.18, Y + 0.04, -0.6), (0.22, 0.024, 0.16), bevel=0.003, rot=(0, 5, 0)),
])

# monitor (Screen is the live OS surface: 16:10 to match SameerOS's 1280x800)
MON_Z = -0.6
SCR_W, SCR_H = 0.6, 0.6 * 800 / 1280
SCR_CY = RY + 0.1 + SCR_H / 2 + 0.03
BZ = 0.008
join('Monitor', [
    span('Mon_Panel', M['black'], -SCR_W / 2 - BZ, SCR_W / 2 + BZ, SCR_CY - SCR_H / 2 - BZ - 0.016, SCR_CY + SCR_H / 2 + BZ,
         MON_Z - 0.012, MON_Z, collection='Monitor', bevel=0.003),
    span('Mon_Chin', M['silver'], -SCR_W / 2 - BZ, SCR_W / 2 + BZ, SCR_CY - SCR_H / 2 - BZ - 0.016,
         SCR_CY - SCR_H / 2 - BZ, MON_Z - 0.0125, MON_Z + 0.0005, collection='Monitor', bevel=0.002),
    span('Mon_Back', M['silver'], -0.15, 0.15, SCR_CY - 0.11, SCR_CY + 0.08, MON_Z - 0.04, MON_Z - 0.012, collection='Monitor', bevel=0.015),
    span('Mon_Neck', M['silver'], -0.025, 0.025, RY + 0.004, SCR_CY - 0.02, MON_Z - 0.075, MON_Z - 0.055, collection='Monitor', bevel=0.005),
    span('Mon_Base', M['silver'], -0.11, 0.11, RY, RY + 0.008, MON_Z - 0.13, MON_Z + 0.03, collection='Monitor', bevel=0.004),
    span('Webcam', M['black'], -0.035, 0.035, SCR_CY + SCR_H / 2 + BZ, SCR_CY + SCR_H / 2 + BZ + 0.03, MON_Z - 0.03, MON_Z + 0.005,
         collection='Monitor', bevel=0.006),
    cyl('Webcam_Lens', M['glass'], (0, SCR_CY + SCR_H / 2 + BZ + 0.015, MON_Z + 0.0055), 0.006, 0.002, verts=16, axis='z'),
])
plane('Screen', mat('ScreenGlass', '#07090c', 0.15), (0, SCR_CY, MON_Z + 0.0008), SCR_W, SCR_H, collection='Monitor')

# desk clock on the riser (the web scene draws the live time onto DeskClock_Screen)
join('Desk_Clock', [box('Clock_Body', M['sage_light'], (0.3, RY + 0.03, -0.53), (0.12, 0.06, 0.045), bevel=0.008)])
plane('DeskClock_Screen', M['clock_screen'], (0.3, RY + 0.031, -0.5072), 0.1, 0.04)
place('potted_plant_04', 'Riser_Succulent', (0.18, RY, -0.55), scale=0.42, tint='#e7e3d6')

# keyboard (75%) with sage keycaps, a cloud wrist rest, desk mat, mouse
span('Desk_Mat', M['felt'], -0.58, 0.52, Y, Y + 0.004, -0.42, -0.06, collection='Props', bevel=0.003)
KX, KZ = -0.05, -0.2
kb = [span('Kb_Base', M['kb_base'], KX - 0.165, KX + 0.165, Y + 0.004, Y + 0.026, KZ - 0.06, KZ + 0.06, bevel=0.006)]
KEY, GAP = 0.0165, 0.0025
for r, n in enumerate([16, 15, 15, 14, 14]):
    zc = KZ - 0.045 + r * (KEY + GAP)
    width = n * (KEY + GAP)
    for c in range(n):
        xc = KX - width / 2 + c * (KEY + GAP) + KEY / 2
        cap = M['keycap'] if (c in (0, n - 1) or r == 0) else M['sage']
        kb.append(box(f'Key_{r}_{c}', cap, (xc, Y + 0.031, zc), (KEY, 0.01, KEY), bevel=0.0025))
kb.append(box('Key_Space', M['keycap'], (KX, Y + 0.031, KZ - 0.045 + 5 * (KEY + GAP)), (0.11, 0.01, KEY), bevel=0.0025))
for i in range(8):  # cloud wrist rest
    kb.append(ball(f'Cloud_{i}', M['sage'], (KX - 0.15 + i * 0.043, Y + 0.018, -0.085), (0.026, 0.016, 0.03), segs=20))
join('Keyboard', kb)
ball('Mouse', M['sage'], (0.33, Y + 0.016, -0.17), (0.031, 0.017, 0.052), segs=32)

# humidifier (wood grain) with a warm ring light; mist rises from Mist_Origin
join('Humidifier', [
    cyl('Hum_Body', M['oak'], (-1.05, Y + 0.1, -0.55), 0.07, 0.2, verts=48),
    ball('Hum_Top', M['oak'], (-1.05, Y + 0.2, -0.55), (0.07, 0.025, 0.07), segs=32),
    cyl('Hum_Ring', M['lamp_glow'], (-1.05, Y + 0.012, -0.55), 0.072, 0.008, verts=48),
    cyl('Hum_Nozzle', M['black'], (-1.05, Y + 0.222, -0.55), 0.012, 0.01, verts=16),
])
empty('Mist_Origin', (-1.05, Y + 0.23, -0.55))

# candles on the desk
for i, (x, z) in enumerate([(-0.85, -0.42), (0.98, -0.3)], start=1):
    cyl(f'Candle_Jar_{i}', M['glass'], (x, Y + 0.04, z), 0.036, 0.08, verts=24)
    cyl(f'Candle_Wax_{i}', M['wax'], (x, Y + 0.03, z), 0.032, 0.055, verts=24)
    cyl(f'Flame_{i}', M['flame'], (x, Y + 0.075, z), 0.006, 0.018, verts=8, r_top=0.0005)
    empty(f'Candle_{i}', (x, Y + 0.09, z))

# tumbler, tulips in a sage vase, notebooks + pen
join('Tumbler', [
    cyl('Tum_Body', M['tumbler'], (0.66, Y + 0.095, -0.45), 0.04, 0.19, verts=32, r_top=0.044),
    cyl('Tum_Lid', M['tumbler'], (0.66, Y + 0.198, -0.45), 0.046, 0.016, verts=32, bevel=0.003),
    cyl('Tum_Straw', M['sage_light'], (0.675, Y + 0.24, -0.45), 0.004, 0.08, verts=8),
    span('Tum_Handle', M['tumbler'], 0.7, 0.715, Y + 0.06, Y + 0.17, -0.46, -0.44, bevel=0.005),
])
vase = place('ceramic_vase_02', 'Tulip_Vase', (0.88, Y, -0.5), scale=0.42, tint='#9fb791')
tul = []
for i in range(7):
    a = i / 7 * math.tau
    bx, bz = 0.88 + math.cos(a) * 0.02, -0.5 + math.sin(a) * 0.02
    tx, tz = 0.88 + math.cos(a) * rnd.uniform(0.05, 0.1), -0.5 + math.sin(a) * rnd.uniform(0.04, 0.08)
    ty = Y + 0.33 + rnd.uniform(-0.03, 0.04)
    tul.append(tube(f'Tulip_Stem_{i}', M['stem'], [(bx, Y + 0.12, bz), ((bx + tx) / 2, (Y + 0.12 + ty) / 2 + 0.02, (bz + tz) / 2),
                                                  (tx, ty, tz)], radius=0.0025))
    tul.append(ball(f'Tulip_Head_{i}', M['petal'], (tx, ty + 0.025, tz), (0.02, 0.032, 0.02), segs=16))
for i in range(4):
    a = i / 4 * math.tau + 0.4
    tul.append(box(f'Tulip_Leaf_{i}', M['leaf3'], (0.88 + math.cos(a) * 0.04, Y + 0.2, -0.5 + math.sin(a) * 0.03),
                   (0.012, 0.16, 0.002), bevel=0, rot=(rnd.uniform(-20, 20), math.degrees(a), rnd.uniform(-25, 25))))
join('Tulips', tul)
join('Notebooks', [
    box('Nb_1', M['cover2'], (0.85, Y + 0.008, -0.17), (0.2, 0.016, 0.27), bevel=0.003, rot=(0, 8, 0)),
    box('Nb_1p', M['paper'], (0.85, Y + 0.008, -0.17), (0.19, 0.012, 0.272), bevel=0, rot=(0, 8, 0)),
    box('Nb_2', M['cover3'], (0.86, Y + 0.024, -0.17), (0.18, 0.014, 0.24), bevel=0.003, rot=(0, 3, 0)),
    box('Nb_3', M['cover1'], (0.86, Y + 0.038, -0.16), (0.17, 0.012, 0.22), bevel=0.003, rot=(0, 11, 0)),
])
place('stationery_supplies', 'Pen', (0.66, Y, -0.13), parts=['stationery_supplies_pen_fancy'], turn=70)
framed('Grow_Frame', art('QuoteGrow', 'quote_grow.png'), (-1.3, Y + 0.09, -0.32), 0.16, 0.16, M['oak'], tilt=10)

# window sill plants + candle
SX = LW + 0.1
place('ceramic_vase_03', 'Fern_Planter', (SX, SILL_Y, 0.22), scale=0.3, tint='#f0ece4')
place('fern_02', 'Fern', (SX, SILL_Y + 0.11, 0.22), parts=['fern_02_c'], scale=0.55, max_tris=8000)
place('potted_plant_02', 'Sill_Plant', (SX, SILL_Y, -0.32), scale=0.36, parts=['potted_plant_02_pot', 'potted_plant_02_leaves'], max_tris=9000)
place('potted_plant_04', 'Sill_Succulent', (SX, SILL_Y, -0.02), scale=0.7)
cyl('Candle_Jar_5', M['glass'], (SX, SILL_Y + 0.04, 0.05 + 0.08), 0.03, 0.07, verts=24)
cyl('Candle_Wax_5', M['wax'], (SX, SILL_Y + 0.03, 0.13), 0.027, 0.05, verts=24)
cyl('Flame_5', M['flame'], (SX, SILL_Y + 0.07, 0.13), 0.005, 0.016, verts=8, r_top=0.0005)
empty('Candle_5', (SX, SILL_Y + 0.085, 0.13))

# ================================================================ pegboard items
HX, HY, HZ = 0.8, 1.6, WALL_Z + 0.06
join('Headphones', [
    tube('HP_Band', M['sage'], [(HX - 0.075, HY - 0.02, HZ), (HX - 0.07, HY + 0.07, HZ), (HX, HY + 0.11, HZ),
                                 (HX + 0.07, HY + 0.07, HZ), (HX + 0.075, HY - 0.02, HZ)], radius=0.008, resolution=3),
    cyl('HP_Cup_L', M['sage'], (HX - 0.078, HY - 0.05, HZ), 0.042, 0.032, verts=32, axis='x', bevel=0.006),
    cyl('HP_Cup_R', M['sage'], (HX + 0.078, HY - 0.05, HZ), 0.042, 0.032, verts=32, axis='x', bevel=0.006),
    cyl('HP_Pad_L', M['cushion'], (HX - 0.058, HY - 0.05, HZ), 0.036, 0.014, verts=32, axis='x'),
    cyl('HP_Pad_R', M['cushion'], (HX + 0.058, HY - 0.05, HZ), 0.036, 0.014, verts=32, axis='x'),
    cyl('HP_Hook', M['silver'], (HX, HY + 0.12, WALL_Z + 0.04), 0.003, 0.05, verts=8, axis='z'),
])
framed('Peg_Print_A', art('LeafPrintB2', 'leaf_print_b.png'), (0.66, 1.84, WALL_Z + 0.03), 0.11, 0.15, M['paint'])
framed('Peg_Print_B', art('LeafPrintA2', 'leaf_print_a.png'), (0.95, 1.85, WALL_Z + 0.03), 0.11, 0.15, M['oak'])
framed('Focus_Card', art('QuoteFocus', 'quote_focus.png'), (1.11, 1.62, WALL_Z + 0.03), 0.15, 0.2, M['oak'])
place('potted_plant_02', 'Peg_Plant', (1.07, PY1 + 0.015, WALL_Z + 0.07), scale=0.3, parts=['potted_plant_02_pot', 'potted_plant_02_leaves'], max_tris=8000)

# ================================================================ trailing pothos vines
base_leaf = K.heart_leaf('Leaf_Base', M['leaf2'], size=0.032)
leaf_mats = [M['leaf1'], M['leaf2'], M['leaf3']]


def vine(name, start, length, strands, spread, seed, outward=0.06):
    r = random.Random(seed)
    parts = []
    for s in range(strands):
        sx = start[0] + r.uniform(-spread, spread)
        sz = start[2] + r.uniform(0, spread * 0.6)
        L = length * r.uniform(0.55, 1.0)
        n = 7
        pts = []
        for k in range(n + 1):
            f = k / n
            pts.append((sx + math.sin(f * 3 + s) * 0.03 + r.uniform(-0.01, 0.01), start[1] - L * f,
                        sz + outward * math.sin(f * math.pi) + r.uniform(-0.01, 0.01)))
        parts.append(tube(f'{name}_Stem_{s}', M['stem'], pts, radius=0.0022))
        leaves = int(L / 0.045)
        for j in range(leaves):
            f = (j + r.uniform(0.2, 0.8)) / leaves
            i = min(int(f * n), n - 1)
            a, b = Vector(pts[i]), Vector(pts[i + 1])
            p = a.lerp(b, f * n - i)
            lf = base_leaf.copy()
            lf.data = base_leaf.data.copy()
            lf.data.materials[0] = r.choice(leaf_mats)
            K.scene.collection.objects.link(lf)
            sc = r.uniform(0.7, 1.25)
            lf.scale = (sc, sc, sc)
            side = 1 if j % 2 else -1
            lf.rotation_euler = (math.radians(r.uniform(-25, 35)), math.radians(side * r.uniform(15, 50)),
                                 math.radians(r.uniform(-60, 60)))
            lf.location = K.T(p.x + side * 0.012, p.y, p.z + 0.01)
            parts.append(lf)
    return join(name, parts)


vine('Vines_Shelf', (-0.85, SY1 + 0.08, WALL_Z + 0.12), 1.0, 6, 0.1, 1)
vine('Vines_Window', (LW + 0.06, 2.62, WIN_Z1 + 0.06), 1.5, 7, 0.06, 2, outward=0.03)
vine('Vines_Peg', (1.08, PY1 + 0.1, WALL_Z + 0.08), 0.55, 4, 0.07, 3)
vine('Vines_Shelf_Low', (0.18, SY2 + 0.05, WALL_Z + 0.14), 0.35, 3, 0.04, 4)
bpy.data.objects.remove(base_leaf, do_unlink=True)

# ================================================================ chair (sage linen, white frame), pulled out
CX, CZ, CR = -0.32, 0.5, 18
chair = [
    cyl('Ch_Lift', M['dark_metal'], (CX, 0.25, CZ), 0.025, 0.3, verts=16),
    cyl('Ch_Hub', M['dark_metal'], (CX, 0.08, CZ), 0.045, 0.04, verts=16),
]
for i in range(5):
    a = i / 5 * math.tau
    ex, ez = CX + math.cos(a) * 0.3, CZ + math.sin(a) * 0.3
    chair.append(tube(f'Ch_Leg_{i}', M['dark_metal'], [(CX, 0.08, CZ), ((CX + ex) / 2, 0.07, (CZ + ez) / 2), (ex, 0.05, ez)],
                      radius=0.014))
    chair.append(ball(f'Ch_Wheel_{i}', M['black'], (ex, 0.028, ez), (0.025, 0.025, 0.025), segs=12))
chair += [
    box('Ch_Seat', M['fabric'], (CX, 0.47, CZ), (0.52, 0.09, 0.5), bevel=0.035),
    box('Ch_Back', M['fabric'], (CX, 0.82, CZ + 0.26), (0.5, 0.56, 0.09), bevel=0.04, rot=(-8, 0, 0)),
    box('Ch_Arm_L', M['chair_frame'], (CX - 0.29, 0.66, CZ + 0.02), (0.05, 0.03, 0.36), bevel=0.012),
    box('Ch_Arm_R', M['chair_frame'], (CX + 0.29, 0.66, CZ + 0.02), (0.05, 0.03, 0.36), bevel=0.012),
    box('Ch_ArmPost_L', M['chair_frame'], (CX - 0.29, 0.56, CZ + 0.12), (0.035, 0.2, 0.03), bevel=0.01),
    box('Ch_ArmPost_R', M['chair_frame'], (CX + 0.29, 0.56, CZ + 0.12), (0.035, 0.2, 0.03), bevel=0.01),
]
ch = join('Chair', chair)
ch.rotation_euler = (0, 0, math.radians(CR))  # the joined object's origin is the gas lift, so it turns in place

# ================================================================ export
for o in list(K.scene.objects):
    if o.type == 'MESH' and o.modifiers:
        K.apply_mods(o)
try:
    if os.path.exists(args.blend):
        os.remove(args.blend)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
except Exception as err:
    print('could not save .blend:', err)
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(args.out),
    export_format='GLB',
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in K.scene.objects if o.type == 'MESH')
print('EXPORTED', args.out, len(K.scene.objects), 'objects', tris, 'triangles')
