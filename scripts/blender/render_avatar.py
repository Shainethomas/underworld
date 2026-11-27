"""Renders the HUD portrait of Rookie from the character kit, so the HUD face
matches the in-game model.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/blender/render_avatar.py -- public/assets/models/character_kit.glb <out.png>
"""
import math
import sys

import bpy
from mathutils import Vector

glb, out = sys.argv[sys.argv.index("--") + 1 :][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

# kit parts, and the meshes of a complete model (rookie.glb, scripts/blender/build_character.py)
SHOW = {"body_head", "body_fingers", "body_hand", "eyes", "hair_eyebrows", "hair_simpleparted", "garment_hoodie",
        "rk_body", "rk_hair", "rk_lashes", "rk_hoodie"}
# RK_Hoodie matches the in-game tint (hoodie colour × MODEL_TINT_GAIN in CharacterAssets.ts)
TINT = {"M_Hoodie": (0.035, 0.036, 0.045), "MI_Hair_1": (0.07, 0.045, 0.03), "RK_Hoodie": (0.0125, 0.013, 0.017),
        # Eevee lights the semi-transparent hair cards much brighter than the game does
        "RK_Hair": (0.11, 0.11, 0.11)}

for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    o.hide_render = o.name not in SHOW
    for slot in o.material_slots:
        m = slot.material
        if not m or not any(m.name.startswith(k) for k in TINT):
            continue
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        c = next(v for k, v in TINT.items() if m.name.startswith(k))
        if m.name.startswith("RK_Hair"):
            # matte: stacked hair cards otherwise add up to a pale sheen
            bsdf.inputs["Roughness"].default_value = 0.95
            bsdf.inputs["Specular IOR Level"].default_value = 0.05
        src = bsdf.inputs["Base Color"].links
        if src:
            mix = m.node_tree.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1
            m.node_tree.links.new(src[0].from_socket, mix.inputs["A"])
            mix.inputs["B"].default_value = (c[0] * 2.4, c[1] * 2.4, c[2] * 2.4, 1)
            m.node_tree.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            bsdf.inputs["Base Color"].default_value = (*c, 1)

# Rookie's suit model is one material for skin and cloth: the area lights below
# put a grey sheen on the black suit, so it is rendered nearly without specular
# and a little darker, closer to how it reads in the game.
suit = bpy.data.materials.get("RK_Body")
if suit:
    next(n for n in suit.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Specular IOR Level"].default_value = 0.05

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
idle = bpy.data.actions.get("Idle_Loop")
if idle:
    # a complete model carries its clips: stand in the idle's first pose
    arm.animation_data_create().action = idle
    if idle.slots:
        arm.animation_data.action_slot = idle.slots[0]
    bpy.context.scene.frame_set(int(idle.frame_range[0]))
else:
    # A-pose the kit's arms so the shoulders read naturally in the crop
    for side, s in (("l", 1), ("r", -1)):
        b = arm.pose.bones.get(f"upperarm_{side}")
        if b:
            b.rotation_mode = "XYZ"
            b.rotation_euler = (0, 0, s * math.radians(-62))

head = arm.matrix_world @ arm.pose.bones["Head"].head
scn = bpy.context.scene
scn.render.engine = "BLENDER_EEVEE"
scn.render.resolution_x = scn.render.resolution_y = 256
scn.render.film_transparent = False
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.collection.objects.link(cam)
scn.camera = cam
cam.data.lens = 85
cam.location = head + Vector((0.2, -1.15, 0.0))
cam.rotation_euler = (head + Vector((0, 0, -0.04)) - cam.location).to_track_quat("-Z", "Y").to_euler()

for loc, energy, color in (((1.2, -1.0, 1.9), 260, (1, 0.78, 0.55)), ((-1.4, -0.4, 1.6), 70, (0.5, 0.6, 1)), ((0.2, 1.3, 2.1), 220, (1, 0.85, 0.7))):
    light = bpy.data.lights.new("l", "AREA")
    light.energy = energy
    light.color = color
    light.size = 0.8
    lo = bpy.data.objects.new("l", light)
    lo.location = head + Vector(loc) - Vector((0, 0, 1.6))
    lo.rotation_euler = (head - lo.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(lo)

world = bpy.data.worlds.new("w")
scn.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.03, 0.028, 0.03, 1)
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Punchy"
if suit:
    scn.view_settings.exposure = -0.5
scn.render.filepath = out
bpy.ops.render.render(write_still=True)
