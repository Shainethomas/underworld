"""Renders the title screen's cast lineup from the game's own character models:
Rookie in front with his arms folded, Victor and Lucas either side of him,
and two of Victor's men behind, on a transparent background, lit like the
dusk backdrop (warm from the front, a hot rim from the city behind).

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/blender/render_menu_cast.py -- art-source/models-uncompressed art-source/menu_cast.png

then `cwebp -q 88 -alpha_q 90` it to public/assets/ui/menu_cast.webp (npm run assets:menu-cast).
"""
import math
import sys

import bpy
from mathutils import Vector

src, out = sys.argv[sys.argv.index("--") + 1 :][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)

# who stands where (metres; the camera looks along +Y), facing, and in which pose.
# Blender's -Y is the models' front (glTF +Z).
CAST = [
    ("alex", (-1.02, 1.35), 16, "Idle_FoldArms_Loop", 0.0),
    ("alex", (1.04, 1.4), -18, "Idle_FoldArms_Loop", 0.0),
    ("victor", (-0.6, 0.62), 12, "Stance_Loop", 0.0),
    ("lucas", (0.62, 0.58), -14, "Idle_Loop", 0.0),
    ("rookie", (0.0, 0.0), 0, "Idle_FoldArms_Loop", 0.0),
]


def place(name, xy, yaw, clip, phase):
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=f"{src}/{name}.glb")
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    for o in new:
        # the helper sphere some builds carry is not part of the character
        if o.type == "MESH" and o.name.startswith("Icosphere"):
            o.hide_render = True
    roots = [o for o in new if o.parent is None]
    for r in roots:
        r.location.x += xy[0]
        r.location.y += xy[1]
        r.rotation_mode = "XYZ"
        r.rotation_euler.z += math.radians(yaw)
    # the imported copy of the clip (a second import of a model brings its own)
    act = next((a for a in bpy.data.actions if a not in acts_before and a.name.startswith(clip)), None) or bpy.data.actions.get(clip)
    if act:
        arm.animation_data_create().action = act
        if getattr(act, "slots", None):
            arm.animation_data.action_slot = act.slots[0]
        start, end = act.frame_range
        return arm, int(start + (end - start) * phase)
    return arm, 0


posed = [place(*c) for c in CAST]
scn = bpy.context.scene
# every clip starts at the same frame: each character holds its own clip's opening pose
scn.frame_set(min(f for _, f in posed) or 1)

# matte cloth and skin: the game's materials read glossier under Eevee's area lights
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Specular IOR Level"].default_value = min(n.inputs["Specular IOR Level"].default_value, 0.12)
            n.inputs["Roughness"].default_value = max(n.inputs["Roughness"].default_value, 0.6)

scn.render.engine = "BLENDER_EEVEE"
scn.render.resolution_x = 1100
scn.render.resolution_y = 1150
scn.render.film_transparent = True
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.collection.objects.link(cam)
scn.camera = cam
cam.data.sensor_fit = "VERTICAL"
cam.data.lens = 40
# a low hero angle, looking slightly up at them
cam.location = Vector((0.0, -4.1, 0.8))
target = Vector((0.0, 0.6, 1.18))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()


def light(kind, loc, energy, color, size=1.5, aim=Vector((0, 0.4, 1.2))):
    data = bpy.data.lights.new("l", kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.size = size
    o = bpy.data.objects.new("l", data)
    o.location = Vector(loc)
    o.rotation_euler = (aim - o.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(o)


# warm key from the front left, a cool fill, and the city's glow hard behind them
light("AREA", (-1.6, -2.8, 2.6), 460, (1.0, 0.78, 0.56), 2.2)
light("AREA", (2.0, -2.2, 1.4), 120, (0.55, 0.62, 0.9), 2.0)
light("AREA", (-1.4, 3.2, 2.4), 520, (1.0, 0.45, 0.32), 2.5)
light("AREA", (1.6, 3.2, 2.2), 420, (1.0, 0.3, 0.3), 2.5)

world = bpy.data.worlds.new("w")
scn.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.035, 0.04, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Medium High Contrast"
scn.render.filepath = out
bpy.ops.render.render(write_still=True)
