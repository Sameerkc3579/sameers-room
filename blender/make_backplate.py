"""Cuts a flat 'photo through the window' out of the equirectangular city panorama.

  python blender/make_backplate.py [--yaw 0.18 --pitch 10 ...]  ->  scene/public/textures/window_view.jpg

Rectilinear reprojection: for every output pixel, find the view ray, convert to (longitude, latitude)
and sample the panorama there.
"""
import numpy as np
from PIL import Image, ImageFilter

import argparse

Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser()
ap.add_argument('--src', default='blender/assets/hdri/lush_dirt_path_full.jpg')
ap.add_argument('--out', default='scene/public/textures/window_view.jpg')
ap.add_argument('--size', default='2400x1600')
ap.add_argument('--hfov', type=float, default=100.0, help='degrees across the output image')
ap.add_argument('--yaw', type=float, default=0.235, help='panorama x (0..1) the window looks toward')
ap.add_argument('--pitch', type=float, default=14.0, help='degrees up (+) or down (-)')
ap.add_argument('--blur', type=float, default=1.4)
a = ap.parse_args()
SRC, OUT, HFOV, YAW, PITCH = a.src, a.out, a.hfov, a.yaw, a.pitch
W, H = map(int, a.size.split('x'))
# The old sunset room used: --src .../sunset_jhbcentral_full.jpg --size 2560x1600 --hfov 80 --yaw 0.565 --pitch 2

pano = np.asarray(Image.open(SRC).convert('RGB'))
ph, pw, _ = pano.shape

f = (W / 2) / np.tan(np.radians(HFOV / 2))
xs = np.arange(W) - W / 2 + 0.5
ys = np.arange(H) - H / 2 + 0.5
x, y = np.meshgrid(xs, ys)
# camera looks down -z; y up in image is -y in pixels
dx, dy, dz = x, -y, -np.full_like(x, f)
# pitch around x axis
p = np.radians(PITCH)
dy, dz = dy * np.cos(p) - dz * np.sin(p), dy * np.sin(p) + dz * np.cos(p)
lon = np.arctan2(dx, -dz)                  # 0 = straight ahead
lat = np.arctan2(dy, np.hypot(dx, dz))
u = (YAW + lon / (2 * np.pi)) % 1.0
v = 0.5 - lat / np.pi
px = np.clip((u * pw).astype(np.int32), 0, pw - 1)
py = np.clip((v * ph).astype(np.int32), 0, ph - 1)
# a soft blur: hides the photo's low-light noise and reads as the eye focusing on the room, not the city
Image.fromarray(pano[py, px]).filter(ImageFilter.GaussianBlur(a.blur)).save(OUT, quality=88, optimize=True, progressive=True)
print('wrote', OUT, f'{W}x{H}')
