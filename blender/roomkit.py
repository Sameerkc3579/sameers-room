"""Small modelling toolkit shared by the room build scripts (runs inside Blender).

Coordinates are the web scene's (three.js: +Y up, -Z toward the back wall); `T()` converts to Blender's Z-up.
Objects can carry a `tint` custom property (exported as glTF extras -> three.js userData.tint) that the web scene
multiplies into their materials; that keeps scanned textures but lets us recolour them (sage pots, cream walls).
"""

import glob
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')
ART = os.path.join(HERE, 'art')
scene = bpy.context.scene


def T(x, y, z):
    """three.js coords -> Blender coords."""
    return Vector((x, -z, y))


def lin(hex_color):
    h = hex_color.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]


# ---------------------------------------------------------------- materials
MATS = {}


def _new(name):
    m = bpy.data.materials.new(name)
    if not m.node_tree:  # older Blender: node trees are opt-in
        m.use_nodes = True
    return m


def mat(name, hex_color, rough=0.6, metal=0.0, emit=None, strength=1.0):
    if name in MATS:
        return MATS[name]
    m = _new(name)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(hex_color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


def _img(nt, path, color):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(path, check_existing=True)
    n.image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return n


def pbr(name, texture):
    """Photo-scanned surface: Poly Haven diffuse + roughness + normal maps."""
    if name in MATS:
        return MATS[name]
    m = _new(name)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    d = os.path.join(ASSETS, 'textures', texture)
    nt.links.new(_img(nt, os.path.join(d, 'diff.jpg'), True).outputs['Color'], b.inputs['Base Color'])
    nt.links.new(_img(nt, os.path.join(d, 'rough.jpg'), False).outputs['Color'], b.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(_img(nt, os.path.join(d, 'nor.jpg'), False).outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    MATS[name] = m
    return m


def art(name, filename, rough=0.75):
    """A print/picture: an image from blender/art as the base colour."""
    if name in MATS:
        return MATS[name]
    m = _new(name)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    nt.links.new(_img(nt, os.path.join(ART, filename), True).outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    MATS[name] = m
    return m


# ---------------------------------------------------------------- objects
COLLS = {}


def coll(name):
    if name not in COLLS:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        COLLS[name] = c
    return COLLS[name]


def finish(obj, name, material, collection='Props', bevel=0.0, uv=None, tint=None, smooth=False):
    obj.name = name
    obj.data.name = name
    if material is not None:
        obj.data.materials.clear()
        obj.data.materials.append(material)
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll(collection).objects.link(obj)
    if uv:
        box_uv(obj, uv)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel > 0:
        b = obj.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = 3
        b.limit_method = 'ANGLE'
        b.harden_normals = True
    if tint:
        obj['tint'] = tint
    return obj


def box_uv(obj, size):
    """World-scale box mapping: the texture repeats every `size` metres on every face."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        ax = max(range(3), key=lambda i: abs(f.normal[i]))
        for loop in f.loops:
            co = obj.matrix_world @ loop.vert.co
            u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
            loop[uv].uv = (u / size, v / size)
    bm.to_mesh(obj.data)
    bm.free()


def _active():
    return bpy.context.active_object


def box(name, material, center, size, collection='Props', bevel=0.003, uv=None, tint=None, rot=(0, 0, 0)):
    """center/size in three.js coords: size = (width x, height y, depth z); rot = degrees about three x, y, z."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(*center))
    o = _active()
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (math.radians(rot[0]), -math.radians(rot[2]), math.radians(rot[1]))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, material, collection, bevel, uv, tint)


def span(name, material, x0, x1, y0, y1, z0, z1, **kw):
    return box(name, material, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
               (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), **kw)


def cyl(name, material, center, radius, height, collection='Props', verts=32, bevel=0.0, axis='y', r_top=None,
        tint=None):
    """Cylinder (or cone with r_top) centred on `center`; axis 'y' vertical, 'z' toward camera, 'x' sideways."""
    if r_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=height, location=T(*center))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=r_top, depth=height,
                                        location=T(*center))
    o = _active()
    if axis == 'z':
        o.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'x':
        o.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(o, name, material, collection, bevel, tint=tint, smooth=True)


def ball(name, material, center, size, collection='Props', segs=24, tint=None):
    """Ellipsoid; size = (x, y, z) radii in three.js axes."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=1, location=T(*center))
    o = _active()
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, name, material, collection, tint=tint, smooth=True)


def plane(name, material, center, w, h, facing='+z', collection='Props', tilt=0.0):
    """Upright w x h plane facing '+z' (camera), '+x' (into the room from the left wall) or '-x'.
    `tilt` leans the top back by that many degrees."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=T(*center))
    o = _active()
    o.scale = (w, h, 1)
    yaw = {'+z': 0, '+x': -math.pi / 2, '-x': math.pi / 2}[facing]
    o.rotation_euler = (math.pi / 2 - math.radians(tilt), 0, yaw)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, name, material, collection)


def empty(name, at):
    e = bpy.data.objects.new(name, None)
    e.location = T(*at)
    scene.collection.objects.link(e)
    return e


def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for mod in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def join(name, objs, tint=None):
    """Merge objects into one mesh (keeps materials): one clickable thing, fewer draw calls."""
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        apply_mods(o)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = _active()
    o.name = name
    o.data.name = name
    for k in list(o.keys()):
        del o[k]
    if tint:
        o['tint'] = tint
    return o


def bounds(objs):
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    return mn, mx


def place(asset, name, at, scale=1.0, turn=0.0, parts=None, collection='Props', max_tris=None, tint=None):
    """Imports a Poly Haven model, keeps `parts` (object-name prefixes), joins it into one object named `name`,
    and stands it with its bottom-centre on `at` (three.js coords), turned `turn` degrees about vertical."""
    files = glob.glob(os.path.join(ASSETS, 'models', asset, '*.gltf'))
    if not files:
        print('MISSING asset', asset)
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=files[0])
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH' and (parts is None or any(o.name.startswith(p) for p in parts))]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in new:
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    obj = join(name, meshes)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mn, mx = bounds([obj])
    obj.data.transform(Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))))
    obj.scale = (scale, scale, scale)
    obj.rotation_euler = (0, 0, math.radians(turn))
    obj.location = T(*at)
    if max_tris:
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if tris > max_tris:
            d = obj.modifiers.new('Decimate', 'DECIMATE')
            d.ratio = max_tris / tris
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll(collection).objects.link(obj)
    if tint:
        obj['tint'] = tint
    return obj


def tube(name, material, points, radius=0.003, collection='Props', resolution=2):
    """A smooth tube through `points` (three.js coords): cables, stems, neon."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = T(*p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return finish(_active(), name, material, collection)


def heart_leaf(name, material, size=0.05):
    """A pothos-style heart leaf (tip pointing -Y in its own space), slightly cupped along the midrib."""
    bm = bmesh.new()
    pts = []
    for i in range(24):
        t = 2 * math.pi * i / 24
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x / 17 * size, 0.0, y / 17 * size))
    centre = bm.verts.new((0, -0.12 * size, -0.05 * size))
    ring = [bm.verts.new((x, abs(x) * 0.25, z)) for x, _, z in pts]
    for i in range(len(ring)):
        bm.faces.new((centre, ring[i], ring[(i + 1) % len(ring)]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    return finish(o, name, material, smooth=True)
