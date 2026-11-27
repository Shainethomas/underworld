"""Builds a complete character GLB (public/assets/models/<name>.glb) from a
Mixamo FBX downloaded "with skin", with every clip the game uses. Each
character is a CHARACTERS entry below.

- If the entry has `clips` (Rookie), every clip is a Mixamo download made
  for this same character: each is sampled straight onto the skeleton, cut
  to a frame range, and optionally looped, shortened (`travel`) or taken in
  place. Nothing is retargeted.
- Otherwise, if the entry says `talk`, the FBX's own clip (Mixamo motion
  capture) replaces Idle_Talking_Loop; otherwise the FBX clip is discarded.
- Every other clip is retargeted from the CC0 Quaternius Universal Animation
  Libraries onto the Mixamo skeleton. Bones are matched in world space (each
  target bone takes the source bone's rotation away from its rest pose), so
  differences in bone roll between the two rigs don't twist anything; fingers
  are included, and hip movement is scaled to the new leg length so feet stay
  planted.
- Mixamo bones are renamed to the Quaternius/kit names (pelvis, spine_01,
  hand_r, Head...), so runtime code that looks bones up by name keeps working.
- Unwanted meshes are dropped; textures are reduced from 4K and exported
  as WebP. `head_height` scales a model to size.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/blender/build_character.py -- <name>
    node scripts/optimize-character.mjs public/assets/models/<name>.glb

(`npm run assets:models` does both for every character.)
"""
import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ANIM_DIR = Path("art-source/quaternius/anim")
FPS = 30

# meshes: FBX mesh object (name contains) -> (new name, material name, roughness, diffuse size).
# The runtime tints meshes by name (MODEL_GARMENT_MESH in CharacterAssets.ts).
CHARACTERS = {
    # Rookie ("Roddy", November 2026): a generated character built low-poly
    # for phones (8.3k triangles, one mesh, 4K textures reduced at export),
    # on the Don's recipe: `fbx` is a rig made outside Mixamo (the kit
    # skeleton with weights hand-fitted to his build, and his arms-crossed
    # clip), `mesh_from` the textured game mesh fitted onto it (see rigged()),
    # and every Mixamo clip (downloaded for Roddy on Mixamo's own rig) is
    # retargeted onto that skeleton in world space (`cross`). Files are in
    # art-source/rookie/; the suited Rookie before him is in old-suit/.
    "rookie": {
        "fbx": "art-source/rookie/rookie_rig.fbx",
        "mesh_from": "art-source/rookie/rookie_mesh.glb",
        "talk": False,
        "drop": [],
        "head_height": 1.556,
        # his maps go out full size: scripts/grade-character.mjs resizes them
        # with a sharper filter than Blender's (and lifts the colour)
        "meshes": {"mesh": ("rk_body", "RK_Body", 0.7, 4096)},
        "normal_size": 4096,
        # game clip -> (file in the rig's folder, first frame, last frame, options):
        #   loop      the last frames blend into the first, so the loop has no seam
        #   travel    scales how far the hips and feet move across the floor
        #   in_place  removes a walk's forward drift; `pace` (m/s, LOCOMOTION
        #             in CharacterExpressions.ts) retimes it so the feet don't slide
        #   cross     the clip is on Mixamo's rig, not this one: retarget it
        "clips": {
            "Idle_Loop": ("idle.fbx", 1, 299, {"loop": True, "cross": True}),
            "Idle_Talking_Loop": ("talking.fbx", 1, 114, {"loop": True, "cross": True}),
            # Mixamo "Boxing" (stance), "Boxing" (lead jab, extended at frame 14),
            # "Boxing" (right hook across the body, frame 18) and "Boxing" (left
            # uppercut, frame 22: stands in for the cross until a straight right is downloaded)
            "Guard_Loop": ("guard.fbx", 1, 67, {"loop": True, "cross": True}),
            "Punch_Jab": ("jab.fbx", 9, 27, {"travel": 0.6, "cross": True}),
            "Punch_Cross": ("uppercut.fbx", 17, 38, {"travel": 0.6, "cross": True}),
            # contact about 0.3 s in, as the scene's timing expects
            "Melee_Hook": ("hook.fbx", 9, 30, {"travel": 0.35, "cross": True}),
            "Melee_Hook_Rec": ("hook.fbx", 30, 61, {"travel": 0.35, "cross": True}),
            # the gloves come up between frames 29 and 53
            "Block": ("block.fbx", 26, 56, {"cross": True}),
            "Hit_Head": ("head_hit.fbx", 1, 40, {"cross": True}),
            "Hit_Chest": ("body_hit.fbx", 1, 41, {"cross": True}),
            # the first dodge: down under the hook (lowest at frame 11) and back up
            "Duck": ("dodging.fbx", 1, 22, {"travel": 0.5, "cross": True}),
            # the press lands at frame 36
            "Interact": ("button_pushing.fbx", 14, 70, {"cross": True}),
            "Sitting_Idle_Loop": ("sitting_idle.fbx", 1, 193, {"loop": True, "cross": True}),
            # standing to seated: down onto the seat by frame 80
            "Sitting_Enter": ("sit_down.fbx", 40, 100, {"cross": True}),
            "PickUp_Table": ("pick_up.fbx", 1, 104, {"cross": True}),
            # a still stretch with the phone at his right ear, feet planted
            "Idle_TalkingPhone_Loop": ("phone.fbx", 346, 445, {"loop": True, "cross": True}),
            # the rig's own clip, fitted with the weights
            "Idle_FoldArms_Loop": ("rookie_rig.fbx", None, None, {"loop": True}),
        },
        # Palm flat on the scanner (no Mixamo clip): the idle with one wrist
        # solved onto a fixed point, fingers up and the palm forward. The left
        # hand, on the scanner camera's side. Wrist position (m): out from
        # that shoulder, forward of the feet, height. FacilityEntrance.ts PALM
        # is where the palm ends up.
        "palm": {"clip": "Palm_Loop", "hand": "l", "wrist": (0.02, 0.4, 1.37)},
        # every clip's feet are set back on the floor after retargeting (see grounded())
        "ground": True,
        # he has no Mixamo walk yet: the kit's walk, retargeted from the shared
        # library like the bodyguards' clips (download "Walking", In Place, to replace it).
        # LayToIdle: lying on his back in bed (its first pose, held) and getting up
        "retarget": ["Walk_Loop", "LayToIdle"],
    },
    # Mixamo "Ch18": black tactical gear, cap and sunglasses, one merged mesh.
    # Both bodyguards. Its clip is a still standing pose, so it isn't used.
    "alex": {
        "fbx": "art-source/alex/alex.fbx",
        "talk": False,
        "drop": [],
        "meshes": {"Ch18": ("al_body", "AL_Body", 0.6, 2048)},
    },
    # The Don: a heavy-set generated character in a white three-piece suit
    # (one mesh), auto-rigged on Mixamo (full skeleton) with Mixamo clips.
    # The FBX doesn't embed its textures: they were saved out of the
    # generator's GLB (king_source.glb).
    "don": {
        # his deforming rig: the kit skeleton with weights hand-fitted to his
        # build, from idle_foldarms_loop_fit.glb (mesh welded and cut to 75k
        # vertices, only read for its weights), with its arms-crossed clip
        "fbx": "art-source/don/kingpin/kingpin_rig.glb",
        # the game mesh (low-poly, textured), fitted onto the rig: see rigged()
        "mesh_from": "art-source/don/kingpin/king_source.glb",
        "talk": False,
        "drop": [],
        "head_height": 1.568,
        "meshes": {"mesh": ("dn_body", "DN_Body", 0.65, 2048)},
        "textures": {"diffuse": "art-source/don/kingpin/king_color.png", "normal": "art-source/don/kingpin/king_normal.png"},
        # `cross`: a Mixamo clip, made on the Mixamo skeleton, retargeted in world space
        "clips": {
            "Idle_Loop": ("idle.fbx", 1, 201, {"loop": True, "cross": True}),
            "Idle_Talking_Loop": ("talking.fbx", 1, 235, {"loop": True, "cross": True}),
            # one full stride from the end of "Start Walking" (he has no
            # walking loop), retimed to his walking speed (ACTOR_PACE in
            # CharacterExpressions.ts); his formal walk uses it too
            "Walk_Loop": ("start_walking.fbx", 46, 87, {"in_place": True, "pace": 1.05, "loop": True, "cross": True}),
            # Mixamo has none: the rig's own. His left arm lies on top; the
            # hand underneath is tucked into his chest out of sight, and the
            # top hand rests on the outside of the other arm, in view (see aim_hands)
            "Idle_FoldArms_Loop": ("kingpin_rig.glb", None, None, {"loop": True, "hands": {
                "r": {"aim": (0.0, 0.85, 0.55), "curl": 100},
                "l": {"aim": (-0.9, 0.3, 0.15), "curl": 30},
            }}),
        },
    },
    # Victor Sable, the boss (November 2026): a heavy-set bald man with a
    # grey beard in a purple three-piece suit, a generated character
    # auto-rigged on Mixamo (one mesh, thumb and index fingers only). Every
    # clip is a Mixamo download on his own rig, so none is retargeted; the
    # FBXs are in art-source/victor/ (idle.fbx carries the mesh).
    "victor": {
        "fbx": "art-source/victor/idle.fbx",
        "talk": False,
        "drop": [],
        # a big man: a little taller than the Don
        "head_height": 1.6,
        "meshes": {"mesh": ("vs_body", "VS_Body", 0.55, 2048)},
        "clips": {
            "Idle_Loop": ("idle.fbx", 1, 100, {"loop": True}),
            "Idle_Talking_Loop": ("talking.fbx", 1, 156, {"loop": True}),
            # watching, hands clasped behind his back: the idle (breathing,
            # weight shifts), with both arms held as in "Male Standing Pose"
            "Stance_Loop": ("idle.fbx", 1, 100, {"loop": True, "arms": ("male_standing_pose.fbx", 1, {"l": 0.08, "r": 0.02})}),
            # right arm out at someone (held from frame 19 to 56), then back down
            "Point": ("pointing.fbx", 1, 84, {}),
            # a backhand wave of the right hand: "go on, get out"
            "Dismiss": ("dismissing_gesture.fbx", 1, 68, {}),
            # a calm stretch with the phone at his right ear, his weight shifting
            # side to side and back (the clip's start and end raise and lower it)
            "Idle_TalkingPhone_Loop": ("talking_on_a_cell_phone.fbx", 133, 319, {"loop": True}),
            # standing to seated: on the seat by frame 53
            "Sitting_Enter": ("stand_to_sit.fbx", 1, 68, {}),
            "Sitting_Idle_Loop": ("sitting_idle.fbx", 1, 130, {"loop": True}),
            # "Swagger Walk": one full stride (frames 24 to 66), in place,
            # at his walking speed (ACTOR_PACE in CharacterExpressions.ts)
            "Walk_Loop": ("swagger_walk.fbx", 24, 66, {"in_place": True, "pace": 0.95, "loop": True}),
        },
    },
    # Lucas (November 2026): Rookie's friend in Scene 01, in place of Ravi,
    # a generated character auto-rigged on Mixamo (one mesh) with his own
    # Mixamo clips (art-source/lucas/, idle.fbx carries the mesh). Leaning
    # on the ring rail has no download, so it's retargeted from the shared
    # library. He doesn't fold his arms.
    "lucas": {
        "fbx": "art-source/lucas/idle.fbx",
        "talk": False,
        "drop": [],
        # a touch shorter than Rookie
        "head_height": 1.54,
        "meshes": {"mesh": ("lc_body", "LC_Body", 0.6, 2048)},
        "clips": {
            "Idle_Loop": ("idle.fbx", 1, 299, {"loop": True}),
            "Idle_Talking_Loop": ("talking.fbx", 1, 309, {"loop": True}),
            # "Walking": one full cycle, in place, at the game's walking speed
            "Walk_Loop": ("walking.fbx", 1, 32, {"in_place": True, "pace": 1.3, "loop": True}),
            # cheering the fight from ringside (his `call_out`)
            "Clapping": ("clapping.fbx", 1, 36, {}),
        },
        # the retargeted clips' feet are set back on the floor (see grounded())
        "ground": True,
        "retarget": ["Idle_Rail_Loop"],
    },
    # The previous Don, kept buildable (`-- don_ch01`, with UW_OUT): Mixamo
    # "Ch01" (art-source/don/gaurd2.fbx, bald; his own polo, jeans and
    # sneakers are dropped) in the white suit (art-source/don/white-suit.glb,
    # unrigged clothing in an A-pose: jacket, shirt, tie, trousers, gloves,
    # shoes). Below the neck his body is removed. See dress().
    "don_ch01": {
        "fbx": "art-source/don/gaurd2.fbx",
        "talk": False,
        "drop": ["Pants", "Shirt", "Sneakers"],
        "meshes": {
            "Body": ("dn_head", "DN_Body", 0.55, 2048),
            "Eyelashes": ("dn_lashes", "DN_Lashes", 0.7, 512),
        },
        "outfit": {
            "glb": "art-source/don/white-suit.glb",
            # shirt collar top, above the neck bone's head (m)
            "collar": 0.085,
            # piece (texture name prefix) -> roughness
            "pieces": {"jacket": 0.65, "shirt": 0.7, "tie": 0.45, "pants": 0.65, "gloves": 0.5, "shoes": 0.3},
            "prefix": "dn",
        },
    },
}
NAME = sys.argv[sys.argv.index("--") + 1]
CFG = CHARACTERS[NAME]
FBX = Path(CFG["fbx"])
# UW_OUT writes somewhere else (e.g. to preview a build without replacing the live file)
OUT = Path(os.environ.get("UW_OUT", f"public/assets/models/{NAME}.glb"))

# Same clips as scripts/build-animations.mjs; Idle_Talking_Loop comes from the FBX when `talk` is set.
CLIPS = {
    "UAL1_Standard.glb": [
        "Idle_Loop", "Walk_Loop", "Walk_Formal_Loop", "Jog_Fwd_Loop",
        "Punch_Jab", "Punch_Cross", "Hit_Chest", "Hit_Head", "Death01", "Roll",
        "Sitting_Enter", "Sitting_Idle_Loop", "Sitting_Talking_Loop", "Sitting_Exit", "Interact",
        "Fixing_Kneeling", "PickUp_Table", "Spell_Simple_Idle_Loop", "Crouch_Idle_Loop",
    ],
    "UAL2_Standard.glb": [
        "Idle_FoldArms_Loop", "Melee_Hook", "Melee_Hook_Rec", "Hit_Knockback",
        "LayToIdle", "Idle_Rail_Loop", "Idle_Rail_Call", "Idle_TalkingPhone_Loop", "Consume",
    ],
}
TALK_CLIP = "Idle_Talking_Loop"
if not CFG["talk"]:
    CLIPS["UAL1_Standard.glb"].append(TALK_CLIP)

# Clips where a hand touches the body: (side, anchor bone). The wrist keeps the
# source's offset from the anchor; see reach().
CONTACTS = {
    "Idle_TalkingPhone_Loop": [("r", "Head")],
    "Idle_FoldArms_Loop": [("l", "spine_03"), ("r", "spine_03")],
}

# Quaternius (kit) bone name -> Mixamo bone name (without the mixamorigN: prefix)
BONE_MAP = {
    "pelvis": "Hips", "spine_01": "Spine", "spine_02": "Spine1", "spine_03": "Spine2",
    "neck_01": "Neck", "Head": "Head",
}
for s, S in (("l", "Left"), ("r", "Right")):
    BONE_MAP.update({
        f"clavicle_{s}": f"{S}Shoulder", f"upperarm_{s}": f"{S}Arm", f"lowerarm_{s}": f"{S}ForeArm", f"hand_{s}": f"{S}Hand",
        f"thigh_{s}": f"{S}UpLeg", f"calf_{s}": f"{S}Leg", f"foot_{s}": f"{S}Foot", f"ball_{s}": f"{S}ToeBase",
    })
    for q, m in (("thumb", "Thumb"), ("index", "Index"), ("middle", "Middle"), ("ring", "Ring"), ("pinky", "Pinky")):
        for i in (1, 2, 3):
            BONE_MAP[f"{q}_0{i}_{s}"] = f"{S}Hand{m}{i}"

MESHES = CFG["meshes"]
DROP = CFG["drop"]
NORMAL_SIZE = 1024


def log(*a):
    print(f"[{NAME}]", *a, flush=True)


def imported(fn, **kw):
    before = set(bpy.data.objects)
    fn(**kw)
    return [o for o in bpy.data.objects if o not in before]


def rot(m: Matrix) -> Quaternion:
    return m.decompose()[1]


def channelbag(action, slot):
    layer = action.layers[0] if action.layers else action.layers.new("Layer")
    strip = layer.strips[0] if layer.strips else layer.strips.new(type="KEYFRAME")
    return strip.channelbag(slot, ensure=True)


def all_fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                yield from cb.fcurves


# ---------------------------------------------------------------- character
def bbox(o):
    co = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
    o.data.vertices.foreach_get("co", co)
    M = np.array(o.matrix_world)
    w = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
    return Vector(w.min(0)), Vector(w.max(0))


def rigged(rig_file, mesh_file):
    """A character on a rig made elsewhere (`mesh_from`): the rig file's
    armature and weighted mesh, and the game's mesh. The game mesh is scaled
    to the rig mesh's height and set on it (feet down, centred), takes its
    skin weights from the nearest point of the rig mesh, at rest, and the
    rig mesh is dropped."""
    load = bpy.ops.import_scene.fbx if rig_file.suffix.lower() == ".fbx" else bpy.ops.import_scene.gltf
    rig = imported(load, filepath=str(rig_file))
    arm = next(o for o in rig if o.type == "ARMATURE")
    src = max((o for o in rig if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    got = imported(bpy.ops.import_scene.gltf, filepath=str(mesh_file))
    mesh = max((o for o in got if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    # the rig's own clip is sampled from the file later, like any other;
    # the importer's bone display shape (an icosphere) goes too
    if arm.animation_data:
        for t in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(t)
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.custom_shape = None
    for o in [o for o in bpy.data.objects if o not in (arm, src, mesh)]:
        bpy.data.objects.remove(o)
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()

    lo, hi = bbox(src)
    mlo, mhi = bbox(mesh)
    k = (hi.z - lo.z) / (mhi.z - mlo.z)
    mesh.matrix_world = Matrix.Scale(k, 4) @ mesh.matrix_world
    bpy.context.view_layer.update()
    mlo, mhi = bbox(mesh)
    mesh.matrix_world = Matrix.Translation(Vector(((lo.x + hi.x - mlo.x - mhi.x) / 2, (lo.y + hi.y - mlo.y - mhi.y) / 2, lo.z - mlo.z))) @ mesh.matrix_world
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    log(f"mesh fitted to the rig x{k:.3f}")

    dt = mesh.modifiers.new("weights", "DATA_TRANSFER")
    dt.object = src
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.datalayout_transfer(modifier=dt.name)
    bpy.ops.object.modifier_apply(modifier=dt.name)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    mesh.parent = arm
    mesh.matrix_parent_inverse = arm.matrix_world.inverted()
    mesh.modifiers.new("Armature", "ARMATURE").object = arm
    bpy.data.objects.remove(src)
    arm.data.pose_position = "POSE"
    log(f"{len(mesh.vertex_groups)} weight groups from the rig mesh")
    return [arm, mesh]


bpy.ops.wm.read_factory_settings(use_empty=True)
if CFG.get("mesh_from"):
    objs = rigged(FBX, Path(CFG["mesh_from"]))
else:
    objs = imported(bpy.ops.import_scene.fbx, filepath=str(FBX))
arm = next(o for o in objs if o.type == "ARMATURE")
prefix = arm.data.bones[0].name.split(":")[0] + ":"

src_fps = bpy.context.scene.render.fps
talk = arm.animation_data.action if arm.animation_data else None
if CFG["talk"]:
    # The FBX clip is at 60 fps; the game's clips are sampled at 30.
    talk.name = TALK_CLIP
    k = FPS / src_fps
    start = talk.frame_range[0]
    for fc in all_fcurves(talk):
        for p in fc.keyframe_points:
            for attr in ("co", "handle_left", "handle_right"):
                v = getattr(p, attr)
                setattr(p, attr, (start + (v[0] - start) * k, v[1]))
        fc.update()
    log("talk clip", talk.frame_range[:], "from", src_fps, "fps")
elif talk:
    arm.animation_data.action = None
    bpy.data.actions.remove(talk)
    talk = None
if arm.animation_data is None:
    arm.animation_data_create()
bpy.context.scene.render.fps = FPS

# Rename bones to the kit's names (vertex groups and the talk action follow).
reverse = {m: q for q, m in BONE_MAP.items()}
for b in arm.data.bones:
    short = b.name[len(prefix):] if b.name.startswith(prefix) else b.name
    b.name = reverse.get(short, short)
missing = [q for q in BONE_MAP if q not in arm.data.bones]
# an auto-rigged character may have only some fingers; nothing at runtime looks fingers up
FINGERS = ("thumb_", "index_", "middle_", "ring_", "pinky_")
assert not [q for q in missing if not q.startswith(FINGERS)], f"bones not found on the Mixamo rig: {missing}"
if missing:
    log("no finger bones:", ", ".join(missing))

for o in objs:
    if o.type == "MESH" and any(d in o.name for d in DROP):
        bpy.data.objects.remove(o)

if CFG.get("head_height"):
    # Scale the whole character so the head bone sits at head_height, and apply
    # the FBX's rotation and scale: the armature ends up at identity, in metres.
    head_z = (arm.matrix_world @ arm.data.bones["Head"].head_local).z
    SCALE = CFG["head_height"] / head_z
    arm.scale = arm.scale * SCALE
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + [o for o in objs if o.type == "MESH" and o.name in bpy.data.objects]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    log(f"scaled x{SCALE:.3f}: head bone at {(arm.matrix_world @ arm.data.bones['Head'].head_local).z:.3f} m")
else:
    SCALE = 1.0


# ---------------------------------------------------------------- materials
def images_of(mat):
    imgs = [n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
    pick = lambda key: next((i for i in imgs if key in (i.filepath + i.name).lower()), None)
    normal = pick("normal")
    # a generated model's colour map isn't called "diffuse": take the other image
    return pick("diffuse") or next((i for i in imgs if i is not normal), None), normal


def sized(img, size):
    # no caching: changing an image's colour space reloads it from the packed file
    if img.size[0] > size:
        img.scale(size, size)
    return img


def has_alpha(img):
    if img.channels < 4:
        return False
    px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return float(px[3::4].min()) < 0.5


def make_material(mat_name, rough, diffuse, dsize, normal, alpha=True):
    m = bpy.data.materials.new(mat_name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0
    if diffuse:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = sized(diffuse, dsize)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha and has_alpha(tex.image):
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            log(mat_name, "uses alpha")
    if normal:
        if normal.colorspace_settings.name != "Non-Color":
            normal.colorspace_settings.name = "Non-Color"
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = sized(normal, CFG.get("normal_size", NORMAL_SIZE))
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return m


for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    key = next((k for k in MESHES if k in o.name), None)
    if not key:
        log("unexpected mesh, dropped:", o.name)
        bpy.data.objects.remove(o)
        continue
    name, mat_name, rough, dsize = MESHES[key]
    diffuse, normal = images_of(o.material_slots[0].material)
    if CFG.get("textures"):
        # textures the FBX only references (not embedded): load them from art-source
        tex = CFG["textures"]
        diffuse = bpy.data.images.load(str(Path(tex["diffuse"]).resolve()))
        normal = bpy.data.images.load(str(Path(tex["normal"]).resolve())) if tex.get("normal") else None
    m = make_material(mat_name, rough, diffuse, dsize, normal, alpha=any(t in name for t in ("hair", "lashes")))
    o.data.materials.clear()
    o.data.materials.append(m)
    o.name = o.data.name = name
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    log(f"{name}: {tris} tris, diffuse {tuple(diffuse.size) if diffuse else None}, normal {tuple(normal.size) if normal else None}")

# ---------------------------------------------------------------- outfit
WORLD_NORMAL = "world_normal"
# how quickly a farther bone's weight fades (m): see dress() step 3
WEIGHT_FALLOFF = 0.025
# joint heights as fractions of neck height on a realistically proportioned
# Mixamo figure (Rookie): where an off-the-peg outfit expects them
PROPORTIONS = {"ankle": 0.083, "knee": 0.334, "hip": 0.606}
SEG_CHILD = {"pelvis": "spine_01", "spine_03": "neck_01", "hand_l": "middle_01_l", "hand_r": "middle_01_r"}


def dress(body, spec):
    """Puts the model in a separate, unrigged outfit (a GLB of clothing pieces
    in an A-pose) and keeps only the model's head and neck.

    1. The outfit is scaled and moved so its shirt collar sits around the neck.
    2. The model's arms and legs are posed to the outfit's A-pose (each limb
       aimed at its glove or shoe).
    3. Skin weights are copied from the posed body to every piece (nearest
       surface, interpolated).
    4. Each piece is un-posed with the inverse of its own skinning, so it fits
       the model's T-pose rest and every retargeted clip works unchanged.
    5. The body below the neck is removed: the gloves and shoes are the hands
       and feet."""
    mw = arm.matrix_world
    Wr = rot(mw)
    J = lambda b: mw @ arm.data.bones[b].head_local
    neck = J("neck_01")
    log("joint heights: " + ", ".join(f"{b} {J(b).z:.2f}" for b in ("Head", "neck_01", "spine_03", "pelvis", "calf_l", "foot_l")))

    objs = imported(bpy.ops.import_scene.gltf, filepath=spec["glb"])
    pieces = {}
    for o in objs:
        if o.type != "MESH":
            continue
        img = next((n.image for sl in o.material_slots if sl.material for n in sl.material.node_tree.nodes
                    if n.type == "TEX_IMAGE" and n.image and n.image.name.endswith("_d")), None)
        key = img.name[:-2] if img else None
        if key in spec["pieces"]:
            pieces[key] = o
    missing = [k for k in spec["pieces"] if k not in pieces]
    assert not missing, f"outfit pieces not found: {missing}"

    # Shading normals, in world space, kept on each corner as an attribute (it
    # survives the face deletions below) and turned with the vertices at the end:
    # moving vertices alone would leave the imported custom normals behind.
    for o in pieces.values():
        me = o.data
        n3 = o.matrix_world.to_3x3().inverted().transposed()
        wn = [c for cn in me.corner_normals for c in (n3 @ cn.vector).normalized()]
        me.attributes.new(WORLD_NORMAL, "FLOAT_VECTOR", "CORNER").data.foreach_set("vector", wn)

    # 1. world-space vertex positions, scaled so the collar sits around the neck
    pos = {k: [o.matrix_world @ v.co for v in o.data.vertices] for k, o in pieces.items()}
    top = max(p.z for p in pos["shirt"])
    ring = [p for p in pos["shirt"] if p.z > top - 0.03]
    ring_c = sum(ring, Vector()) / len(ring)
    s = (neck.z + spec["collar"]) / top
    shift = Vector((neck.x - ring_c.x * s, neck.y - ring_c.y * s, 0))
    for k in pos:
        pos[k] = [p * s + shift for p in pos[k]]
    log(f"outfit scaled x{s:.3f}; trouser waist at {max(p.z for p in pos['pants']):.2f}")

    # Remap heights below the neck so the outfit's hip, knee and ankle (where a
    # realistically proportioned figure has them) land on this skeleton's
    # joints: a cartoon build with short legs gets shorter trousers and a
    # longer jacket instead of knees that bend mid-thigh. Gloves move with the
    # cuffs; shoes stay on the floor as they are.
    N = neck.z
    src_k = [0.0, PROPORTIONS["ankle"] * N, PROPORTIONS["knee"] * N, PROPORTIONS["hip"] * N, N]
    dst_k = [0.0, J("foot_l").z, J("calf_l").z, J("thigh_l").z, N]
    zmap = lambda z: float(np.interp(z, src_k, dst_k)) if z < N else z
    for k in pos:
        if k in ("shoes",):
            continue
        if k == "gloves":
            for sgn in (1, -1):
                idx = [i for i, p in enumerate(pos[k]) if p.x * sgn > 0]
                top_z = max(pos[k][i].z for i in idx)
                dz = zmap(top_z) - top_z
                for i in idx:
                    pos[k][i] = pos[k][i] + Vector((0, 0, dz))
            continue
        pos[k] = [Vector((p.x, p.y, zmap(p.z))) for p in pos[k]]
    log("outfit heights remapped: " + ", ".join(f"{a:.2f}->{b:.2f}" for a, b in zip(src_k[1:4], dst_k[1:4])))

    # Inner layers (shirt, trousers) are cut away wherever the jacket covers
    # them: skinned separately, they would otherwise poke through it.
    for k, o in pieces.items():
        for v, p in zip(o.data.vertices, pos[k]):
            v.co = p
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
    jm = pieces["jacket"].data
    jbvh = BVHTree.FromPolygons([v.co.copy() for v in jm.vertices], [tuple(f.vertices) for f in jm.polygons])
    axis = J("spine_02")
    # (the jacket itself too: its lining, just under the outer shell)
    for k, reach in [(k, 0.08) for k in spec.get("under_jacket", ("shirt", "pants"))] + [("jacket", 0.012)]:
        me = pieces[k].data
        # covered: a ray straight out from the body's centre line hits the jacket
        covered = []
        for v in me.vertices:
            d = Vector((v.co.x - axis.x, v.co.y - axis.y, 0))
            if d.length < 1e-4:
                covered.append(False)
                continue
            d.normalize()
            covered.append(jbvh.ray_cast(v.co + d * 5e-4, d, reach)[0] is not None)
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        visible = {f for f in bm.faces if not all(covered[v.index] for v in f.verts)}
        # keep one ring around everything visible, so no gap opens at the jacket's edges
        ring = {g for f in visible for v in f.verts for g in v.link_faces}
        hidden = [f for f in bm.faces if f not in visible and f not in ring]
        bmesh.ops.delete(bm, geom=hidden, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(me)
        bm.free()
        pos[k] = [v.co.copy() for v in me.vertices]
        log(f"{k}: {len(hidden)} faces under the jacket removed")

    # 2. pose the limbs to the outfit's A-pose
    def side_pts(k, sgn):
        return [p for p in pos[k] if p.x * sgn > 0]

    def aim(bone, tip_bone, target):
        bpy.context.view_layer.update()
        pb = arm.pose.bones[bone]
        head = mw @ pb.head
        tip = mw @ arm.pose.bones[tip_bone].head
        r = Wr.inverted() @ (tip - head).rotation_difference(target - head) @ Wr
        m = pb.matrix.copy()
        pb.matrix = Matrix.Translation(m.to_translation()) @ (r @ m.to_quaternion()).to_matrix().to_4x4()
        bpy.context.view_layer.update()

    for side, sgn in (("l", 1), ("r", -1)):
        glove = side_pts("gloves", sgn)
        shoulder = J(f"upperarm_{side}")
        glove.sort(key=lambda p: (p - shoulder).length)
        n = max(1, len(glove) // 10)
        wrist = sum(glove[:n], Vector()) / n
        aim(f"upperarm_{side}", f"hand_{side}", wrist)
        shoe = side_pts("shoes", sgn)
        shoe.sort(key=lambda p: -p.z)
        n = max(1, len(shoe) // 5)
        ankle = sum(shoe[:n], Vector()) / n
        ankle.z = J(f"foot_{side}").z
        aim(f"thigh_{side}", f"foot_{side}", ankle)

    # 3. weights by distance to the posed bones, so the body's own shape
    #    (a cartoon build, say) doesn't matter
    bpy.context.view_layer.update()
    segs, seg_names = [], []
    for bone in arm.data.bones:
        kids = list(bone.children)
        if not kids:
            continue
        kid = next((c for c in kids if c.name == SEG_CHILD.get(bone.name)), kids[0])
        segs.append((mw @ arm.pose.bones[bone.name].head, mw @ arm.pose.bones[kid.name].head))
        seg_names.append(bone.name)
    A = np.array([a for a, _ in segs])
    D = np.array([b - a for a, b in segs])
    DD = np.maximum((D * D).sum(1), 1e-9)

    deform = {b.name: mw @ arm.pose.bones[b.name].matrix @ b.matrix_local.inverted() @ mw.inverted() for b in arm.data.bones}
    inv = body.matrix_world.inverted()
    pre = spec["prefix"]
    for k, o in pieces.items():
        me = o.data
        for v, p in zip(me.vertices, pos[k]):
            v.co = p
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
        o.vertex_groups.clear()
        groups = {n: o.vertex_groups.new(name=n) for n in seg_names}
        P = np.array(pos[k])
        t = np.clip(((P[:, None, :] - A[None]) * D[None]).sum(2) / DD[None], 0, 1)
        dist = np.linalg.norm(P[:, None, :] - (A[None] + t[..., None] * D[None]), axis=2)
        # Four nearest bones, each falling off with how much farther it is than
        # the nearest one: blends stay local to joints (the chest follows the
        # spine, not the arms) and vary smoothly, so layers a few millimetres
        # apart (a jacket's lining) move together.
        near = np.argsort(dist, axis=1)[:, :4]
        for i, idx in enumerate(near):
            d = dist[i, idx]
            w = np.exp(-(d - d.min()) / WEIGHT_FALLOFF)
            w = w / w.sum()
            for j, wt in zip(idx, w):
                if wt > 1e-3:
                    groups[seg_names[j]].add([i], float(wt), "REPLACE")

        # 4. un-pose into the T-pose rest, then into the body's space
        names = {g.index: g.name for g in o.vertex_groups}
        unpose = []
        for v in me.vertices:
            S = Matrix(((0,) * 4,) * 4)
            total = 0.0
            for g in v.groups:
                if g.weight > 0:
                    S = S + deform[names[g.group]] * g.weight
                    total += g.weight
            U = (S * (1 / total)).inverted_safe() if total > 0 else Matrix.Identity(4)
            unpose.append(U.to_3x3())
            v.co = inv @ (U @ v.co)
        # normals: through the same un-pose, then into the body's space
        attr = me.attributes[WORLD_NORMAL]
        wn = np.empty(len(me.loops) * 3, dtype=np.float32)
        attr.data.foreach_get("vector", wn)
        to_body = inv.to_3x3()
        normals = []
        for loop in me.loops:
            n = Vector(wn[loop.index * 3 : loop.index * 3 + 3])
            n = unpose[loop.vertex_index].inverted_safe().transposed() @ n
            normals.append((to_body.inverted_safe().transposed() @ n).normalized())
        me.attributes.remove(attr)
        # the outfit's vertex colours would multiply into its textures (glTF COLOR_0)
        for ca in list(me.color_attributes):
            me.color_attributes.remove(ca)
        # every face smooth, or flat-flagged faces ignore the custom normals and light up as facets
        me.shade_smooth()
        me.normals_split_custom_set(normals)
        me.update()
        o.parent = arm
        o.matrix_parent_inverse = body.matrix_parent_inverse.copy()
        o.matrix_basis = body.matrix_basis.copy()
        am = o.modifiers.new("Armature", "ARMATURE")
        am.object = arm

        imgs = bpy.data.images
        diffuse, normal = imgs.get(f"{k}_d"), imgs.get(f"{k}_n")
        if normal:
            normal.colorspace_settings.is_data = True
        mat = make_material(f"{pre.upper()}_{k.capitalize()}", spec["pieces"][k], diffuse, 1024, normal, alpha=False)
        me.materials.clear()
        me.materials.append(mat)
        o.name = me.name = f"{pre}_{k}"
        log(f"{o.name}: {sum(len(f.vertices) - 2 for f in me.polygons)} tris")

    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    kept = set(pieces.values())
    for o in objs:
        if o not in kept:
            bpy.data.objects.remove(o)

    # 5. keep only the head and a neck that ends inside the shirt collar
    bm = bmesh.new()
    bm.from_mesh(body.data)
    M = body.matrix_world
    head = J("Head")
    cut = neck.z + 0.01
    top = head.z + spec.get("head_from", 0.03)
    r = spec.get("neck_radius", 0.11)
    gone = []
    for f in bm.faces:
        c = M @ f.calc_center_median()
        if c.z > top:
            continue
        # sideways only: shoulder flaps stick out to the sides, the chin and face forward
        if c.z > cut and abs(c.x - head.x) < r:
            continue
        gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bm.to_mesh(body.data)
    bm.free()
    log(f"{body.name}: {len(body.data.polygons)} faces kept above the neck")


if CFG.get("outfit"):
    dress(bpy.data.objects[next(iter(MESHES.values()))[0]], CFG["outfit"])

# ---------------------------------------------------------------- retarget
Wt = rot(arm.matrix_world)
Wt_inv = Wt.inverted()
arm_inv = arm.matrix_world.inverted()
t_rest = {b.name: rot(b.matrix_local) for b in arm.data.bones}
t_rest_head = {b.name: b.head_local.copy() for b in arm.data.bones}
order = []  # parents before children


def walk(b):
    order.append(b)
    for c in b.children:
        walk(c)


for b in arm.data.bones:
    if not b.parent:
        walk(b)

arm.animation_data.action = None
if talk:
    talk_track = arm.animation_data.nla_tracks.new()
    talk_track.name = TALK_CLIP
    s = talk_track.strips.new(TALK_CLIP, int(talk.frame_range[0]), talk)
    s.action_slot = talk.slots[0]


def local_q(name, pose_arm, world_arm):
    """Local rotation for `name` that gives arm-space rotation `world_arm` under its parent's pose."""
    b = arm.data.bones[name]
    p = b.parent.name
    base = pose_arm[p] @ (t_rest[p].inverted() @ t_rest[name])
    return base.inverted() @ world_arm


def joints(pose_arm, hip_arm):
    """Forward kinematics: arm-space joint positions for this frame. The
    pelvis is where the clip puts the hips; a bone above it (a fitted rig's
    `root`, at floor level) stays where it rests."""
    pos = {}
    for b in order:
        if b.name == "pelvis":
            pos[b.name] = hip_arm
            continue
        if not b.parent:
            pos[b.name] = t_rest_head[b.name].copy()
            continue
        p = b.parent.name
        pos[b.name] = pos[p] + (pose_arm[p] @ t_rest[p].inverted()) @ (t_rest_head[b.name] - t_rest_head[p])
    return pos


def reach(src, pose_arm, rots, hip_arm, side, anchor):
    """Puts the wrist where the source's wrist sits relative to `anchor`
    (Mixamo arms are shorter, so copied rotations alone fall short of the ear
    or the opposite arm)."""
    pos = joints(pose_arm, hip_arm)
    s_mw = src.matrix_world
    hd = f"hand_{side}"
    offset_w = s_mw @ src.pose.bones[hd].head - s_mw @ src.pose.bones[anchor].head
    T = arm_inv @ (arm.matrix_world @ pos[anchor] + offset_w)
    two_bone(pose_arm, rots, pos, f"upperarm_{side}", f"lowerarm_{side}", hd, T)


def two_bone(pose_arm, rots, pos, up, lo, hd, T, end_rot=None):
    """Two-bone IK: moves the end of the up-lo chain (wrist, ankle) to arm-space
    point T. The elbow or knee stays in its current plane, and the end bone
    keeps its orientation (or takes `end_rot`, arm space)."""
    A, B, C = pos[up], pos[lo], pos[hd]
    l1, l2 = (B - A).length, (C - B).length
    AT = T - A
    d = min(max(AT.length, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999)
    dir_at = AT.normalized()
    n = dir_at.cross(B - A)
    if n.length < 1e-6:
        return
    n.normalize()
    ang = math.acos(max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    B2 = A + (Quaternion(n, ang) @ dir_at) * l1
    T2 = A + dir_at * d
    R1 = (B - A).rotation_difference(B2 - A)
    R2 = (R1 @ (C - B)).rotation_difference(T2 - B2)
    new = {up: R1 @ pose_arm[up], lo: R2 @ R1 @ pose_arm[lo], hd: pose_arm[hd] if end_rot is None else end_rot}
    for bname in (up, lo, hd):
        pose_arm[bname] = new[bname]
        q = local_q(bname, pose_arm, new[bname]).normalized()
        seq = rots[bname]
        if len(seq) > 1 and seq[-2].dot(q) < 0:
            q.negate()
        seq[-1] = q


def retarget(src, src_action, name):
    scene = bpy.context.scene
    src.animation_data.action = src_action
    if not src.animation_data.action_slot and src_action.slots:
        src.animation_data.action_slot = src_action.slots[0]
    f0, f1 = (int(round(x)) for x in src_action.frame_range)
    Wq = rot(src.matrix_world)
    s_rest = {q: Wq @ rot(src.data.bones[q].matrix_local) for q in BONE_MAP}
    s_rest_hip = src.matrix_world @ src.data.bones["pelvis"].head_local
    t_rest_hip = arm.matrix_world @ arm.data.bones["pelvis"].head_local
    ratio = t_rest_hip.z / s_rest_hip.z

    frames = list(range(f0, f1 + 1))
    rots = {b.name: [] for b in order}
    hip_loc = []
    for f in frames:
        scene.frame_set(f)
        hip_w = src.matrix_world @ src.pose.bones["pelvis"].head
        want = arm_inv @ (t_rest_hip + (hip_w - s_rest_hip) * ratio)
        pose_arm = {}
        for b in order:
            pb_src = src.pose.bones.get(b.name) if b.name in BONE_MAP else None
            rel_rest = (t_rest[b.parent.name].inverted() @ t_rest[b.name]) if b.parent else t_rest[b.name]
            base = (pose_arm[b.parent.name] @ rel_rest) if b.parent else rel_rest
            if pb_src:
                delta = (Wq @ rot(pb_src.matrix)) @ s_rest[b.name].inverted()
                desired = Wt_inv @ delta @ Wt @ t_rest[b.name]
                q = base.inverted() @ desired
            else:
                q = Quaternion()
            q.normalize()
            prev = rots[b.name][-1] if rots[b.name] else None
            if prev is not None and prev.dot(q) < 0:
                q.negate()
            rots[b.name].append(q)
            pose_arm[b.name] = base @ q
        for side, anchor in CONTACTS.get(name, []):
            reach(src, pose_arm, rots, want, side, anchor)
        hip_loc.append(t_rest["pelvis"].inverted() @ (want - t_rest_head["pelvis"]))

    write_clip(name, frames, rots, hip_loc)


# Clips where the feet legitimately leave their standing height (lying, rolling, kneeling)
GROUND_EXEMPT = {"Death01", "LayToIdle", "Roll", "Hit_Knockback", "Fixing_Kneeling"}


def grounded(name, rots, hip_loc):
    """Keeps the feet on the floor (`ground` in a character's entry). A clip
    retargeted from another skeleton, or with its steps shortened (`travel`),
    can leave the soles under the floor or above it: here every frame is
    raised or lowered so the lowest heel or toe is at its standing height. Rewrites
    hip_loc in place."""
    if not CFG.get("ground") or name in GROUND_EXEMPT:
        return
    # each foot's heel end (the ankle) and toe end (the ball), at their standing heights
    marks = [b for b in ("foot_l", "foot_r", "ball_l", "ball_r") if b in t_rest_head]
    up_local = t_rest["pelvis"].inverted() @ Vector((0, 0, 1))
    worst = 0.0
    for i in range(len(hip_loc)):
        pose = {}
        for bone in order:
            rel_rest = (t_rest[bone.parent.name].inverted() @ t_rest[bone.name]) if bone.parent else t_rest[bone.name]
            base = (pose[bone.parent.name] @ rel_rest) if bone.parent else rel_rest
            pose[bone.name] = base @ rots[bone.name][i]
        hip = t_rest_head["pelvis"] + t_rest["pelvis"] @ hip_loc[i]
        pos = joints(pose, hip)
        # the lowest of them goes back to its standing height: neither heel nor toe under the floor
        d = max(t_rest_head[b].z - pos[b].z for b in marks)
        worst = max(worst, abs(d))
        hip_loc[i] = hip_loc[i] + up_local * d
    if worst > 0.01:
        log(f"{name}: feet put back on the floor (off by up to {worst * 100:.0f} cm)")


def write_clip(name, frames, rots, hip_loc):
    """Keys the clip as its own action on an NLA track (exported as one glTF animation)."""
    grounded(name, rots, hip_loc)
    act = bpy.data.actions.new(name)
    slot = act.slots.new(id_type="OBJECT", name=arm.name)
    cb = channelbag(act, slot)
    n = len(frames)

    def curve(path, idx, values):
        fc = cb.fcurves.new(path, index=idx)
        fc.keyframe_points.add(n)
        co = np.empty(n * 2, dtype=np.float32)
        co[0::2] = frames
        co[1::2] = values
        fc.keyframe_points.foreach_set("co", co)
        fc.update()

    for b in order:
        path = f'pose.bones["{b.name}"].rotation_quaternion'
        qs = rots[b.name]
        for i in range(4):
            curve(path, i, [q[i] for q in qs])
    for i in range(3):
        curve('pose.bones["pelvis"].location', i, [v[i] for v in hip_loc])

    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(frames[0]), act)
    strip.action_slot = slot
    log(f"{name}: {n} frames")


def loop_blend(rots, hip_loc):
    """Eases the last frames into the first, so a loop has no seam."""
    n = len(hip_loc)
    k = max(2, min(10, n // 4))
    for i in range(k):
        idx, w = n - k + i, (i + 1) / k
        for seq in rots.values():
            q = seq[idx].slerp(seq[0], w)
            if seq[idx - 1].dot(q) < 0:
                q.negate()
            seq[idx] = q
        hip_loc[idx] = hip_loc[idx].lerp(hip_loc[0], w)


def mixamo_frames(file, a, b, loop=False, travel=1.0, in_place=False, pace=None, cross=False):
    """Samples a clip made for this same rig: every bone takes the source
    bone's orientation directly (the skeletons match bone for bone), and the
    hips' path is scaled to the character's size. With `cross` the clip is
    on another skeleton (a Mixamo download for a character on its own rig):
    each mapped bone takes the source's rotation away from its rest pose, in
    world space, and the hips move by the ratio of hip heights. a and b
    default to the clip's first and last frames. Returns (frames, rots,
    hip_loc)."""
    path = FBX.parent / file
    load = bpy.ops.import_scene.gltf if path.suffix == ".glb" else bpy.ops.import_scene.fbx
    src_objs = imported(load, filepath=str(path))
    src = next(o for o in src_objs if o.type == "ARMATURE")
    sp = src.data.bones[0].name.split(":")[0] + ":"
    if cross:
        sname = {b.name: sp + BONE_MAP[b.name] for b in order if b.name in BONE_MAP}
    else:
        sname = {b.name: b.name if b.name in src.pose.bones else sp + BONE_MAP.get(b.name, b.name) for b in order}
    absent = [t for t, s in sname.items() if s not in src.pose.bones]
    # a clip from a rig with fewer fingers: those fingers stay at rest
    if cross:
        for t in [t for t in absent if t.startswith(FINGERS)]:
            del sname[t]
        absent = [t for t in absent if not t.startswith(FINGERS)]
    assert not absent, f"{file}: bones missing from the clip's rig: {absent}"
    a = round(src.animation_data.action.frame_range[0]) if a is None else a
    b = round(src.animation_data.action.frame_range[1]) if b is None else b
    scene = bpy.context.scene
    Ws = src.matrix_world.copy()
    WsR = rot(Ws)
    S = SCALE
    if cross:
        s_rest = {t: WsR @ rot(src.data.bones[n].matrix_local) for t, n in sname.items()}
        s_hip = Ws @ src.data.bones[sname["pelvis"]].head_local
        t_hip = arm.matrix_world @ arm.data.bones["pelvis"].head_local
        ratio = t_hip.z / s_hip.z

    def at(t):
        scene.frame_set(int(t), subframe=t - int(t))

    def world(bone):
        if cross:
            return t_hip + (Ws @ src.pose.bones[sname[bone]].head - s_hip) * ratio
        return S * (Ws @ src.pose.bones[sname[bone]].head)

    # where the hips and feet start (the clip's first frame, a neutral stance)
    # and, for an in-place walk, the drift over the cycle
    at(src.animation_data.action.frame_range[0])
    ref = {k: world(k) for k in ("pelvis", "foot_l", "foot_r")}
    at(a)
    hip_a = world("pelvis")
    at(b)
    drift = world("pelvis") - hip_a
    drift.z = 0
    count = b - a
    if pace:
        natural = drift.length / (count / FPS)
        count = round(count * natural / pace)
        log(f"{file}: stride {drift.length:.2f} m, natural {natural:.2f} m/s, retimed to {pace} m/s ({count + 1} frames)")
    times = [a + (b - a) * i / count for i in range(count + 1)]

    def moved(p, r):
        # scale the horizontal travel from the start, keeping the height
        return Vector((r.x + (p.x - r.x) * travel, r.y + (p.y - r.y) * travel, p.z))

    rots = {b_.name: [] for b_ in order}
    hip_loc = []
    for i, t in enumerate(times):
        at(t)
        hip_w = world("pelvis")
        if in_place:
            hip_w = hip_w - drift * ((t - a) / (b - a))
        if travel != 1.0:
            hip_w = moved(hip_w, ref["pelvis"])
        want = arm_inv @ hip_w
        pose_arm = {}
        for bone in order:
            rel_rest = (t_rest[bone.parent.name].inverted() @ t_rest[bone.name]) if bone.parent else t_rest[bone.name]
            base = (pose_arm[bone.parent.name] @ rel_rest) if bone.parent else rel_rest
            n = sname.get(bone.name)
            if n is None:
                # a bone the source doesn't have (the rig's root, IK and leaf bones): left at rest
                q = Quaternion()
            else:
                pb = rot(src.pose.bones[n].matrix)
                if cross:
                    desired = Wt_inv @ (WsR @ pb) @ s_rest[bone.name].inverted() @ Wt @ t_rest[bone.name]
                else:
                    desired = Wt_inv @ WsR @ pb
                q = (base.inverted() @ desired).normalized()
            seq = rots[bone.name]
            if seq and seq[-1].dot(q) < 0:
                q.negate()
            seq.append(q)
            pose_arm[bone.name] = base @ q
        if travel != 1.0:
            # shorter steps: each foot moves the same fraction of its own
            # path, so a planted foot stays planted
            pos = joints(pose_arm, want)
            for s in ("l", "r"):
                T = arm_inv @ moved(world(f"foot_{s}"), ref[f"foot_{s}"])
                two_bone(pose_arm, rots, pos, f"thigh_{s}", f"calf_{s}", f"foot_{s}", T)
        hip_loc.append(t_rest["pelvis"].inverted() @ (want - t_rest_head["pelvis"]))

    for o in src_objs:
        bpy.data.objects.remove(o)
    for o in [o for o in bpy.data.objects if o.type == "MESH" and o.parent is None]:
        bpy.data.objects.remove(o)
    bpy.data.orphans_purge(do_recursive=True)
    if loop:
        loop_blend(rots, hip_loc)
    return list(range(len(times))), rots, hip_loc


def aim_hands(frames, rots, hip_loc, spec):
    """Re-aims hands on a clip: per side, the fingers point along `aim`
    (character space at the first frame: +X his left, -Y forward, +Z up; it
    turns with the chest after that), and the fingers curl by `curl`
    degrees. Rewrites rots in place."""
    def fk(i):
        pose = {}
        for bone in order:
            rel_rest = (t_rest[bone.parent.name].inverted() @ t_rest[bone.name]) if bone.parent else t_rest[bone.name]
            base = (pose[bone.parent.name] @ rel_rest) if bone.parent else rel_rest
            pose[bone.name] = base @ rots[bone.name][i]
        return pose

    chest0 = fk(0)["spine_03"]
    for i in range(len(frames)):
        pose = fk(i)
        turn = pose["spine_03"] @ chest0.inverted()
        for side, h in spec.items():
            hd = f"hand_{side}"
            fingers = pose[hd] @ Vector((0, 1, 0))
            want = turn @ Vector(h["aim"]).normalized()
            pose[hd] = fingers.rotation_difference(want) @ pose[hd]
            q = local_q(hd, pose, pose[hd]).normalized()
            if i and rots[hd][i - 1].dot(q) < 0:
                q.negate()
            rots[hd][i] = q
            bend = Quaternion(Vector((0, 0, 1)), math.radians(h["curl"]))
            for f in ("index", "middle", "ring", "pinky"):
                for j in (1, 2, 3):
                    n = f"{f}_0{j}_{side}"
                    if n in rots:
                        rots[n][i] = (rots[n][i] @ bend).normalized()


def palm_clip(spec, idle):
    """The idle with one wrist held on a fixed point: palm forward, fingers up."""
    frames, rots, hip_loc = idle
    rots = {k: list(v) for k, v in rots.items()}
    h = spec["hand"]
    chain = (f"upperarm_{h}", f"lowerarm_{h}", f"hand_{h}")
    # the character faces -Y: his left is +X, his right -X
    out = 1 if h == "l" else -1
    shoulder = t_rest_head[chain[0]]
    side, fwd, height = spec["wrist"]
    T = Vector((shoulder.x + out * side, -fwd, height))
    # palm normal in the hand bone's frame: at rest the hand hangs with the palm to the thigh
    y_l = Vector((0, 1, 0))
    p_l = t_rest[chain[2]].inverted() @ Vector((-out, 0, 0))
    p_l = (p_l - y_l * p_l.dot(y_l)).normalized()
    local = Matrix((p_l, y_l, p_l.cross(y_l))).transposed()
    fingers, palm = Vector((0, -0.25, 1)).normalized(), Vector((0, -1, 0))
    palm = (palm - fingers * palm.dot(fingers)).normalized()
    target = Matrix((palm, fingers, palm.cross(fingers))).transposed()
    hand = (target @ local.transposed()).to_quaternion()
    for i in range(len(frames)):
        pose_arm = {}
        for bone in order:
            rel_rest = (t_rest[bone.parent.name].inverted() @ t_rest[bone.name]) if bone.parent else t_rest[bone.name]
            base = (pose_arm[bone.parent.name] @ rel_rest) if bone.parent else rel_rest
            pose_arm[bone.name] = base @ rots[bone.name][i]
        want = t_rest_head["pelvis"] + t_rest["pelvis"] @ hip_loc[i]
        pos = joints(pose_arm, want)
        # two_bone rewrites the last entry of each sequence: work on a one-frame view
        view = {k: [v[i]] for k, v in rots.items()}
        two_bone(pose_arm, view, pos, *chain, T, end_rot=hand)
        for k in chain:
            q = view[k][0]
            if i and rots[k][i - 1].dot(q) < 0:
                q.negate()
            rots[k][i] = q
    # where the palm's centre lands, for FacilityEntrance.ts (glTF -> Babylon: x flips, -Y is +z)
    centre = T + fingers * 0.075 + palm * 0.02
    log(f"{spec['clip']}: palm centre x={-centre.x:.3f} z={-centre.y:.3f} y={centre.z:.3f} (Babylon, from the feet)")
    write_clip(spec["clip"], frames, rots, hip_loc)


for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"

def hold_arms(clip, file, frame, back=None):
    """Holds both arms (clavicle to fingertips) in one frame of another clip
    on this rig, over the whole of `clip`: the arms keep that pose relative
    to the chest while the body below and the head move as `clip` does.
    `back` (m, per side) moves each wrist that much further behind him, for
    hands clasped behind a back the jacket would otherwise swallow."""
    _, pose_rots, _ = mixamo_frames(file, frame, frame + 1)
    frames, rots, hip_loc = clip
    stack = [arm.data.bones[f"clavicle_{s}"] for s in ("l", "r")]
    while stack:
        b = stack.pop()
        stack.extend(b.children)
        rots[b.name][:] = [pose_rots[b.name][0].copy() for _ in frames]
    if not back:
        return
    for i in range(len(frames)):
        pose_arm = {}
        for bone in order:
            rel_rest = (t_rest[bone.parent.name].inverted() @ t_rest[bone.name]) if bone.parent else t_rest[bone.name]
            base = (pose_arm[bone.parent.name] @ rel_rest) if bone.parent else rel_rest
            pose_arm[bone.name] = base @ rots[bone.name][i]
        pos = joints(pose_arm, t_rest_head["pelvis"] + t_rest["pelvis"] @ hip_loc[i])
        # he faces -Y: behind him is +Y, turned with his chest
        behind = pose_arm["spine_03"] @ t_rest["spine_03"].inverted() @ Vector((0, 1, 0))
        for s, d in back.items():
            chain = (f"upperarm_{s}", f"lowerarm_{s}", f"hand_{s}")
            view = {k: [v[i]] for k, v in rots.items()}
            two_bone(pose_arm, view, pos, *chain, pos[chain[2]] + behind * d)
            pos = joints(pose_arm, t_rest_head["pelvis"] + t_rest["pelvis"] @ hip_loc[i])
            for k in chain:
                q = view[k][0]
                if i and rots[k][i - 1].dot(q) < 0:
                    q.negate()
                rots[k][i] = q


if CFG.get("clips"):
    sampled = {}
    for clip, (file, a, b, opts) in CFG["clips"].items():
        hands = opts.pop("hands", None)
        arms = opts.pop("arms", None)
        sampled[clip] = mixamo_frames(file, a, b, **opts)
        if hands:
            aim_hands(*sampled[clip], hands)
        if arms:
            hold_arms(sampled[clip], *arms)
        write_clip(clip, *sampled[clip])
    if CFG.get("palm"):
        palm_clip(CFG["palm"], sampled["Idle_Loop"])

# a character with its own Mixamo clips retargets only what it lists in `retarget`
RETARGET = (
    {f: [c for c in cs if c in CFG.get("retarget", [])] for f, cs in CLIPS.items()} if CFG.get("clips") else CLIPS
)
for file, clips in ((f, cs) for f, cs in RETARGET.items() if cs):
    before_actions = set(bpy.data.actions)
    new = imported(bpy.ops.import_scene.gltf, filepath=str(ANIM_DIR / file))
    src = next(o for o in new if o.type == "ARMATURE")
    actions = {a.name: a for a in bpy.data.actions if a not in before_actions}
    if src.animation_data is None:
        src.animation_data_create()
    src.animation_data.nla_tracks.clear() if hasattr(src.animation_data.nla_tracks, "clear") else None
    for t in list(src.animation_data.nla_tracks):
        src.animation_data.nla_tracks.remove(t)
    for clip in clips:
        a = actions.get(clip) or next((v for k, v in actions.items() if k.startswith(clip)), None)
        assert a, f"{file}: clip {clip} not found (have {sorted(actions)[:5]}...)"
        retarget(src, a, clip)
    for o in new:
        bpy.data.objects.remove(o)
    for a in actions.values():
        bpy.data.actions.remove(a)

arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.rotation_quaternion = Quaternion()
    pb.location = Vector()

# ---------------------------------------------------------------- export
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT),
    export_format="GLB",
    export_animation_mode="NLA_TRACKS",
    export_image_format="WEBP",
    export_image_quality=88,
    export_optimize_animation_size=True,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
)
log("wrote", OUT, f"{OUT.stat().st_size / 1e6:.1f} MB")
