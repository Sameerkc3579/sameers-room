"""Renders SameerOS's leaf wallpaper: a macro shot of a scanned syngonium (Poly Haven, CC0) with shallow depth of
field, lit by the green_sanctuary sky so the background melts into green bokeh.

  blender -b -P blender/render_wallpaper.py -- --out os/public/wallpaper.jpg [--w 1920 --h 1200 --samples 96]
"""
import argparse
import glob
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='os/public/wallpaper.jpg')
ap.add_argument('--w', type=int, default=1920)
ap.add_argument('--h', type=int, default=1200)
ap.add_argument('--samples', type=int, default=96)
args = ap.parse_args(argv)

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, 'assets')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# sky light + background
world = bpy.data.worlds.new('World')
sc.world = world
nt = world.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(A, 'hdri', 'green_sanctuary_1k.hdr'))
nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
nt.nodes['Background'].inputs['Strength'].default_value = 1.1

# the plant, a few copies at different depths so the frame fills with leaves
src = glob.glob(os.path.join(A, 'models', 'potted_plant_02', '*.gltf'))[0]
leaves = []
for i, (pos, rot, s) in enumerate([((0, 0, 0), 0, 1.0), ((-0.35, 0.3, 0.05), 1.9, 1.1), ((0.38, 0.4, -0.04), -2.4, 1.15),
                                    ((0.02, 0.75, 0.12), 3.6, 1.2), ((-0.3, -0.25, -0.1), 0.9, 0.9)]):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=src)
    for o in set(bpy.data.objects) - before:
        if o.type == 'MESH' and 'leaves' not in o.name:
            bpy.data.objects.remove(o, do_unlink=True)
        elif o.parent is None:
            o.location = Vector(pos)
            o.rotation_euler = (0, 0, rot)
            o.scale = (s, s, s)
    leaves += [o for o in set(bpy.data.objects) - before if o.name in bpy.data.objects and o.type == 'MESH']

bpy.context.view_layer.update()
pts = [o.matrix_world @ v.co for o in leaves for i, v in enumerate(o.data.vertices) if i % 7 == 0]
centre = sum(pts, Vector()) / len(pts)
focus = Vector((centre.x + 0.02, centre.y - 0.05, centre.z + 0.06))

cam_data = bpy.data.cameras.new('Cam')
cam_data.lens = 70
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new('Cam', cam_data)
sc.collection.objects.link(cam)
cam.location = focus + Vector((0.1, -0.85, -0.24))  # from below, looking up into the green canopy
cam.rotation_euler = (focus - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.dof.focus_distance = (focus - cam.location).length
sc.camera = cam

sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = args.samples
sc.cycles.use_denoising = True
sc.render.resolution_x = args.w
sc.render.resolution_y = args.h
sc.render.image_settings.file_format = 'JPEG'
sc.render.image_settings.quality = 88
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.filepath = os.path.abspath(args.out)
bpy.ops.render.render(write_still=True)
print('RENDERED', args.out)
