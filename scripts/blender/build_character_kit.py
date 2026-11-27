"""Builds public/assets/models/character_kit.glb from the CC0 Quaternius
Universal Base Characters (art-source/quaternius).

One skinned body is split into regions (so covered skin can be hidden), and
garment shells are generated from those regions: each garment is the body
surface pushed out along its normals, keeping the body's skin weights, so it
deforms with every animation in the Universal Animation Library. Hair meshes
are rebound to the same armature. At runtime CharacterAssets picks which
meshes each character shows and tints their materials.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/blender/build_character_kit.py -- <art-source/quaternius> <out.glb>
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

SRC, OUT = (Path(p) for p in sys.argv[sys.argv.index("--") + 1 :][:2])
TEX_SIZE = 1024

# Garments are cut from the T-posed body along planes placed at bone joints, so
# every hem, cuff and neckline is a clean edge loop. Each body segment is a
# separate mesh so skin a garment fully covers can be hidden at runtime.
SEGMENTS = ["head", "trunk", "shoulder", "arm", "hand", "fingers", "hips", "shins", "feet"]

# name: (segments covered, push-out (m), relax iterations, material)
GARMENTS = {
    "tank": (["trunk"], 0.010, 6, "M_Tank"),
    "tee": (["trunk", "shoulder"], 0.013, 8, "M_Tee"),
    "hoodie": (["trunk", "shoulder", "arm"], 0.024, 14, "M_Hoodie"),
    "jacket": (["trunk", "shoulder", "arm"], 0.021, 12, "M_Jacket"),
    "coat": (["trunk", "shoulder", "arm"], 0.027, 14, "M_Coat"),
    "pants": (["hips", "shins"], 0.014, 10, "M_Pants"),
    "shorts": (["hips"], 0.015, 8, "M_Shorts"),
    "shoes": (["feet"], 0.008, 6, "M_Shoes"),
    "wraps": (["hand"], 0.005, 2, "M_Wraps"),
}

HAIR = ["Hair_SimpleParted", "Hair_Buzzed", "Hair_Long", "Hair_Beard"]


def log(*a):
    print("[kit]", *a, flush=True)


def import_gltf(path: Path):
    before = set(bpy.data.objects)
    # merge_vertices welds UV-seam splits so shells relax without creases
    bpy.ops.import_scene.gltf(filepath=str(path), merge_vertices=True)
    return [o for o in bpy.data.objects if o not in before]


def new_material(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return m


def joints(arm):
    """Rest-pose joint positions (world space, T-pose) used to place the cuts."""
    mw = arm.matrix_world
    head = lambda b: mw @ arm.data.bones[b].head_local
    j = {
        "shoulder_x": abs(head("upperarm_l").x),
        "elbow_x": abs(head("lowerarm_l").x),
        "wrist_x": abs(head("hand_l").x),
        "knuckle_x": abs(head("middle_01_l").x),
        "neck_z": head("neck_01").z,
        "waist_z": head("spine_01").z + 0.04,
        "knee_z": head("calf_l").z,
        "ankle_z": head("foot_l").z,
    }
    j["tee_x"] = (j["shoulder_x"] + j["elbow_x"]) / 2 + 0.02
    j["cuff_x"] = j["wrist_x"] - 0.05
    j["knuckle_x"] += 0.005
    j["shorts_z"] = j["knee_z"] + 0.11
    j["shoe_z"] = j["ankle_z"] + 0.03
    j["arm_x"] = j["shoulder_x"] + 0.015
    j["neck_x"] = 0.065
    return j


def cut_planes(j):
    planes = []
    for x in (j["arm_x"], j["tee_x"], j["cuff_x"], j["knuckle_x"]):
        planes += [((x, 0, 0), (1, 0, 0)), ((-x, 0, 0), (-1, 0, 0))]
    # neckline: flat across the neck, rising along the trapezius toward the shoulders
    for side in (1, -1):
        planes.append(((side * j["neck_x"], 0, j["neck_z"]), tuple(Vector((-side * NECK_SLOPE, 0, 1)).normalized())))
    for z in (j["neck_z"], j["waist_z"], j["shorts_z"], j["shoe_z"]):
        planes.append(((0, 0, z), (0, 0, 1)))
    return planes


NECK_SLOPE = 0.55


def neckline_z(ax, j):
    return j["neck_z"] + NECK_SLOPE * max(0.0, ax - j["neck_x"])


def segment_of(c, j):
    ax = abs(c.x)
    if ax > j["arm_x"] and c.z > j["waist_z"]:
        if ax < j["tee_x"]:
            return "shoulder"
        if ax < j["cuff_x"]:
            return "arm"
        return "hand" if ax < j["knuckle_x"] else "fingers"
    if c.z >= neckline_z(ax, j):
        return "head"
    if c.z >= j["waist_z"]:
        return "trunk"
    if c.z >= j["shorts_z"]:
        return "hips"
    return "shins" if c.z >= j["shoe_z"] else "feet"


def bisect(obj, planes):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for co, no in planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=no)
    bm.to_mesh(obj.data)
    bm.free()


def extract(src, name, keep):
    """Duplicate `src` keeping only polygons whose index is in `keep`."""
    dup = src.copy()
    dup.data = src.data.copy()
    dup.name = dup.data.name = name
    bpy.context.collection.objects.link(dup)
    bm = bmesh.new()
    bm.from_mesh(dup.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context="FACES")
    bm.to_mesh(dup.data)
    bm.free()
    return dup


def build_shoes(feet, arm, front_sign, material):
    """A shoe per foot: an ellipsoid fitted to the foot's bounds, flat-soled,
    with a lower toe box and a raised heel collar, skinned from the foot."""
    parts = []
    for side in (1, -1):
        pts = [feet.matrix_world @ v.co for v in feet.data.vertices if v.co.x * side > 0]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), 0.0))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        centre = (lo + hi) / 2
        size = (hi - lo) / 2 + Vector((0.012, 0.016, 0))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1, location=(centre.x, centre.y, 0))
        o = bpy.context.active_object
        height = 0.105
        for v in o.data.vertices:
            x, y, z = v.co
            fwd = y * front_sign  # +1 at the toe, -1 at the heel
            zz = max(z, 0.0) ** 0.8 if z > 0 else z * 0.08
            toe = 1 - 0.45 * max(0.0, fwd) ** 2
            v.co = Vector((x * size.x * (1 - 0.15 * max(0.0, -fwd)), y * size.y, zz * height * toe + 0.012))
        o.name = o.data.name = f"shoe_{side}"
        o.data.materials.append(material)
        for f in o.data.polygons:
            f.use_smooth = True
        copy_weights(o, feet)
        rig(o, arm)
        parts.append(o)
    join_into(parts[0], parts[1:])
    return parts[0]


def relax_and_push(obj, dist, iterations, arm_x, flatten_below=None):
    """Smooth away muscle definition (cloth drapes over it), then push out along normals.
    Open edges stay pinned so hems and cuffs keep their shape, and are pushed only
    within their cut plane (horizontal for neck/waist/ankle, across the arm for
    cuffs) so the edge stays a clean line instead of zig-zagging."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    inner = [v for v in bm.verts if not v.is_boundary]
    rest = {v: v.co.copy() for v in bm.verts}
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        n = v.normal.copy()
        if v.is_boundary:
            axis = Vector((1, 0, 0)) if abs(v.co.x) > arm_x else Vector((0, 0, 1))
            n -= axis * n.dot(axis)
            if n.length < 1e-6:
                continue
            n.normalize()
        # never end up inside the body: push from whichever is further out
        inward = (rest[v] - v.co).dot(n)
        v.co += n * (dist + max(0.0, inward))
        if flatten_below is not None and v.co.z < flatten_below:
            v.co.z = max(v.co.z, 0.0) * 0.3
    bm.to_mesh(obj.data)
    bm.free()


def extrude_hem(obj, length, flare):
    """Extend the lowest open edge loop of a top garment downwards (jacket/hoodie hem)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bnd = [e for e in bm.edges if e.is_boundary]
    zmin = min(min(v.co.z for v in e.verts) for e in bnd)
    hem = [e for e in bnd if max(v.co.z for v in e.verts) < zmin + 0.06]
    centre = sum((v.co for e in hem for v in e.verts), Vector()) / (2 * len(hem))
    res = bmesh.ops.extrude_edge_only(bm, edges=hem)
    for v in (g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)):
        out = Vector((v.co.x - centre.x, v.co.y - centre.y, 0))
        if out.length > 0:
            out.normalize()
        v.co += Vector((0, 0, -length)) + out * flare
    bm.to_mesh(obj.data)
    bm.free()


def skirt_weights(obj, body, waist_z, length, share=0.65):
    """A long hem hangs from the hips but has to clear the thighs: below the
    waist, blend each vertex's weights toward the nearest body vertex's, more
    the lower it hangs, so the skirt follows the legs without splitting."""
    tree = KDTree(len(body.data.vertices))
    for i, v in enumerate(body.data.vertices):
        tree.insert(body.matrix_world @ v.co, i)
    tree.balance()
    body_names = {g.index: g.name for g in body.vertex_groups}
    own_names = {g.index: g.name for g in obj.vertex_groups}
    for v in obj.data.vertices:
        co = obj.matrix_world @ v.co
        if co.z > waist_z - 0.02:
            continue
        k = share * min(1.0, (waist_z - co.z) / length)
        _, idx, _ = tree.find(co)
        mix = {}
        for g in v.groups:
            mix[own_names[g.group]] = mix.get(own_names[g.group], 0.0) + (1 - k) * g.weight
        for g in body.data.vertices[idx].groups:
            mix[body_names[g.group]] = mix.get(body_names[g.group], 0.0) + k * g.weight
        for name, w in mix.items():
            vg = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            vg.add([v.index], w, "REPLACE")


def push_where(obj, amount):
    """Extra push along horizontal normals; `amount(co)` gives metres per vertex."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    for v in bm.verts:
        a = amount(v.co)
        if a <= 0:
            continue
        n = Vector((v.normal.x, v.normal.y, 0))
        if n.length < 1e-4:
            continue
        v.co += n.normalized() * a
    bm.to_mesh(obj.data)
    bm.free()


def tailor(name, g, j):
    """Shape a garment away from the superhero physique toward real tailoring."""
    knee, shoe, waist = j["knee_z"] + 0.25, j["shoe_z"], j["waist_z"]
    if name == "pants":
        # straight trouser legs: widen progressively below the knee
        push_where(g, lambda c: 0.006 + 0.038 * max(0.0, min(1.0, (knee - c.z) / (knee - shoe))) ** 0.8 if c.z < knee else 0.006)
    elif name in ("jacket", "coat"):
        # a straight cut over the stomach, a touch of padding at the shoulders
        def amount(c):
            a = 0.0
            if waist - 0.15 < c.z < waist + 0.28 and abs(c.x) < j["arm_x"]:
                a += 0.014 * (1 - abs(c.z - (waist + 0.06)) / 0.3)
            if c.z > j["neck_z"] - 0.12 and 0.1 < abs(c.x) < j["arm_x"] + 0.08:
                a += 0.008
            return a
        push_where(g, amount)
    elif name == "hoodie":
        push_where(g, lambda c: 0.012 if waist - 0.1 < c.z < waist + 0.25 and abs(c.x) < j["arm_x"] else 0.0)


def copy_weights(acc, ref):
    """Bind an accessory mesh by copying skin weights from the nearest vertex of `ref`."""
    tree = KDTree(len(ref.data.vertices))
    for i, v in enumerate(ref.data.vertices):
        tree.insert(ref.matrix_world @ v.co, i)
    tree.balance()
    names = {g.index: g.name for g in ref.vertex_groups}
    groups = {}
    for v in acc.data.vertices:
        _, idx, _ = tree.find(acc.matrix_world @ v.co)
        for g in ref.data.vertices[idx].groups:
            name = names[g.group]
            if name not in groups:
                groups[name] = acc.vertex_groups.get(name) or acc.vertex_groups.new(name=name)
            groups[name].add([v.index], g.weight, "REPLACE")


def faces_to_object(src, name, pick, push, material):
    """New object from the faces of `src` that satisfy pick(poly), pushed out a little."""
    keep = {p.index for p in src.data.polygons if pick(p)}
    if not keep:
        return None
    o = extract(src, name, keep)
    o.data.materials.clear()
    o.data.materials.append(material)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * push
    bm.to_mesh(o.data)
    bm.free()
    return o


def join_into(target, parts):
    parts = [p for p in parts if p]
    if not parts:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()


def surface_point(ref, x, z, front_sign, out=0.004):
    """Point on the front surface of `ref` nearest (x, *, z)."""
    best = None
    for v in ref.data.vertices:
        co = ref.matrix_world @ v.co
        if co.y * front_sign <= 0:
            continue
        d = (co.x - x) ** 2 + (co.z - z) ** 2
        if best is None or d < best[0]:
            best = (d, co)
    co = best[1]
    return Vector((x, co.y + front_sign * out, z))


def small_mesh(name, centre, size, material, kind="sphere"):
    if kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=1, location=centre)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = o.data.name = name
    o.data.materials.append(material)
    return o


def rig(o, arm):
    o.parent = arm
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


V_TOP, V_DEPTH = 0.12, 0.30
LAPEL = 0.055


def shirt_front(obj, front_sign, neck_z):
    """Cut a crisp open-collar V of shirt into the front of a jacket."""
    v_top, v_depth = V_TOP, V_DEPTH
    planes = []
    for side in (1, -1):
        n = Vector((side * v_depth, 0, -v_top)).normalized()
        planes.append(((side * v_top, 0, neck_z), tuple(n)))
        planes.append(((side * v_top, 0, 0), (side, 0, 0)))
    bisect(obj, planes)
    for p in obj.data.polygons:
        c = p.center
        if c.y * front_sign < 0:
            continue
        # above the neck line the V is full width: it reads as the shirt collar
        depth = neck_z - c.z
        if depth < v_depth and abs(c.x) < v_top * (1 - max(0.0, depth) / v_depth):
            p.material_index = 1


def sunglasses(arm, eyes):
    """Two dark lenses bound to the head bone (for bodyguards)."""
    pts = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
    out = []
    for side in (-1, 1):
        sel = [p for p in pts if p.x * side > 0]
        c = sum(sel, Vector()) / len(sel)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1, location=c)
        lens = bpy.context.active_object
        lens.scale = (0.024, 0.006, 0.017)
        out.append(lens)
    bpy.ops.object.select_all(action="DESELECT")
    for o in out:
        o.select_set(True)
    bpy.context.view_layer.objects.active = out[0]
    bpy.ops.object.join()
    g = bpy.context.active_object
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # nudge forward off the eyes
    front = 1 if sum(v.co.y for v in eyes.data.vertices) > 0 else -1
    for v in g.data.vertices:
        v.co.y += front * 0.018
    g.name = g.data.name = "acc_sunglasses"
    vg = g.vertex_groups.new(name="Head")
    vg.add(list(range(len(g.data.vertices))), 1.0, "REPLACE")
    g.parent = arm
    mod = g.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    g.data.materials.append(new_material("M_Lens", (0.02, 0.02, 0.025), rough=0.08, metal=0.6))
    return g


def glasses(arm, eyes):
    """Thin metal frames with clear lenses, bound to the head bone (the scientist)."""
    pts = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
    front = 1 if sum(p.y for p in pts) > 0 else -1
    frame = new_material("M_Frame", (0.05, 0.05, 0.055), rough=0.3, metal=0.85)
    lens_mat = new_material("M_ClearLens", (0.85, 0.9, 0.95), rough=0.05)
    parts = []
    centres = {}
    for side in (-1, 1):
        sel = [p for p in pts if p.x * side > 0]
        c = sum(sel, Vector()) / len(sel) + Vector((0, front * 0.02, 0.002))
        centres[side] = c
        bpy.ops.mesh.primitive_torus_add(major_segments=28, minor_segments=6, major_radius=1, minor_radius=0.09, location=c, rotation=(math.pi / 2, 0, 0))
        rim = bpy.context.active_object
        rim.scale = (0.026, 0.026, 0.019)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        rim.data.materials.append(frame)
        parts.append(rim)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=8, radius=1, location=c)
        lens = bpy.context.active_object
        lens.scale = (0.024, 0.0025, 0.017)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        lens.data.materials.append(lens_mat)
        parts.append(lens)

    def bar(a, b, r):
        d = b - a
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=d.length, location=(a + b) / 2)
        o = bpy.context.active_object
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        o.data.materials.append(frame)
        return o

    bridge_l = centres[-1] + Vector((0.022, 0, 0.006))
    bridge_r = centres[1] + Vector((-0.022, 0, 0.006))
    parts.append(bar(bridge_l, bridge_r, 0.0018))
    for side in (-1, 1):
        hinge = centres[side] + Vector((side * 0.027, 0, 0.004))
        ear = hinge + Vector((side * 0.012, -front * 0.095, -0.004))
        parts.append(bar(hinge, ear, 0.0016))
    g = parts[0]
    join_into(g, parts[1:])
    g.name = g.data.name = "acc_glasses"
    for f in g.data.polygons:
        f.use_smooth = True
    vg = g.vertex_groups.new(name="Head")
    vg.add(list(range(len(g.data.vertices))), 1.0, "REPLACE")
    rig(g, arm)
    return g


def coat_details(g, arm, j, front_sign):
    """Three buttons below the open collar and a breast pocket with a pen (lab coat)."""
    neck = j["neck_z"]
    button_mat = bpy.data.materials.get("M_Button") or new_material("M_Button", (0.05, 0.05, 0.05), rough=0.3)
    parts = []
    for k, dz in enumerate((0.04, 0.16, 0.28)):
        c = surface_point(g, 0.0, neck - V_DEPTH - dz, front_sign, 0.006)
        b = small_mesh(f"coat_button_{k}", c, (0.009, 0.004, 0.009), button_mat)
        copy_weights(b, g)
        rig(b, arm)
        parts.append(b)
    pen_mat = new_material("M_Pen", (0.03, 0.05, 0.12), rough=0.35)
    c = surface_point(g, 0.11, neck - 0.14, front_sign, 0.009)
    pen = small_mesh("coat_pen", c, (0.004, 0.004, 0.028), pen_mat, "cube")
    copy_weights(pen, g)
    rig(pen, arm)
    parts.append(pen)
    join_into(g, parts)


def jacket_details(g, arm, j, front_sign):
    """Satin lapels along the V, two buttons below it, and a pocket square (separate part)."""
    neck = j["neck_z"]
    lapel_mat = new_material("M_Lapel", (0.1, 0.1, 0.1), rough=0.35)
    planes = [((0, 0, neck - V_DEPTH - 0.02), (0, 0, 1))]
    for side in (1, -1):
        n = Vector((side * V_DEPTH, 0, -V_TOP)).normalized()
        planes.append(((side * (V_TOP + LAPEL), 0, neck), tuple(n)))
    bisect(g, planes)

    def on_lapel(p):
        c = p.center
        if p.material_index != 0 or c.y * front_sign < 0:
            return False
        depth = neck - c.z
        if not (0.0 <= depth < V_DEPTH + 0.02):
            return False
        edge = V_TOP * (1 - max(0.0, depth) / V_DEPTH)
        return edge <= abs(c.x) < edge + LAPEL * (1 - max(0.0, depth) / V_DEPTH) + 0.3 * LAPEL

    lapel = faces_to_object(g, "lapel_tmp", on_lapel, 0.005, lapel_mat)
    buttons = []
    button_mat = new_material("M_Button", (0.05, 0.05, 0.05), rough=0.3)
    for k, dz in enumerate((0.05, 0.17)):
        c = surface_point(g, 0.0, neck - V_DEPTH - dz, front_sign, 0.006)
        b = small_mesh(f"button_{k}", c, (0.011, 0.004, 0.011), button_mat)
        b.rotation_euler = (0, 0, 0)
        copy_weights(b, g)
        rig(b, arm)
        buttons.append(b)
    if lapel:
        rig(lapel, arm)
    join_into(g, [lapel, *buttons])

    # pocket square: its own part so only the Don wears one
    c = surface_point(g, 0.115, neck - 0.17, front_sign, 0.007)
    sq = small_mesh("acc_pocket_square", c, (0.026, 0.004, 0.016), new_material("M_Pocket", (0.5, 0.05, 0.06), rough=0.35), "cube")
    copy_weights(sq, g)
    rig(sq, arm)


def hoodie_details(g, arm, j, front_sign):
    """Kangaroo pocket and drawstrings."""
    waist = j["waist_z"]
    lo, hi, w = waist + 0.01, waist + 0.19, 0.15
    planes = [((0, 0, lo), (0, 0, 1)), ((0, 0, hi), (0, 0, 1))]
    for side in (1, -1):
        planes.append(((side * w, 0, lo), tuple(Vector((side, 0, 0.25)).normalized())))
    bisect(g, planes)

    def on_pocket(p):
        c = p.center
        return c.y * front_sign > 0 and abs(c.x) < w - (c.z - lo) * 0.25 and lo < c.z < hi

    pocket = faces_to_object(g, "pocket_tmp", on_pocket, 0.009, g.data.materials[0])
    string_mat = new_material("M_String", (0.8, 0.8, 0.78), rough=0.6)
    strings = []
    for side in (-1, 1):
        top = surface_point(g, side * 0.045, j["neck_z"] - 0.02, front_sign, 0.008)
        bottom = top + Vector((side * 0.008, 0, -0.17))
        mid = (top + bottom) / 2
        s = small_mesh(f"string_{side}", mid, (0.004, 0.004, 0.085), string_mat, "cube")
        copy_weights(s, g)
        rig(s, arm)
        strings.append(s)
    if pocket:
        rig(pocket, arm)
    join_into(g, [pocket, *strings])


def belt(g, arm, j, front_sign):
    """Leather belt with a buckle, as its own part (suits and jeans wear it)."""
    waist = j["waist_z"]
    b = faces_to_object(g, "garment_belt", lambda p: waist - 0.05 < p.center.z < waist - 0.008, 0.007, new_material("M_Belt", (0.04, 0.03, 0.025), rough=0.35))
    if not b:
        return
    rig(b, arm)
    c = surface_point(b, 0.0, waist - 0.029, front_sign, 0.004)
    buckle = small_mesh("buckle", c, (0.028, 0.006, 0.02), new_material("M_Buckle", (0.75, 0.6, 0.3), rough=0.25, metal=1), "cube")
    copy_weights(buckle, b)
    rig(buckle, arm)
    join_into(b, [buckle])
    b.name = b.data.name = "garment_belt"


def band(g, j, material):
    """Contrast waistband on shorts."""
    g.data.materials.append(material)
    top = max((g.matrix_world @ v.co).z for v in g.data.vertices)
    for p in g.data.polygons:
        if p.center.z > top - 0.045:
            p.material_index = len(g.data.materials) - 1


def soles(g, material):
    g.data.materials.append(material)
    for p in g.data.polygons:
        if (g.matrix_world @ p.center).z < 0.026:
            p.material_index = len(g.data.materials) - 1


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    new = import_gltf(SRC / "base" / "Superhero_Male_FullBody.gltf")
    arm = next(o for o in new if o.type == "ARMATURE")
    arm.name = "Armature"
    body = bpy.data.objects["SuperHero_Male"]
    eyes = bpy.data.objects["Eyes"]
    brows = bpy.data.objects["Eyebrows"]
    for o in new:
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)

    # Hair, rebound to the main armature
    hair_mat = brows.data.materials[0]
    for h in HAIR:
        objs = import_gltf(SRC / "hair" / f"{h}.gltf")
        for o in objs:
            if o.type == "MESH" and o.parent and o.parent.type == "ARMATURE":
                mw = o.matrix_world.copy()
                o.parent = arm
                o.matrix_world = mw
                for m in o.modifiers:
                    if m.type == "ARMATURE":
                        m.object = arm
                o.data.materials.clear()
                o.data.materials.append(hair_mat)
                o.name = o.data.name = "hair_" + h.split("_", 1)[1].lower()
        for o in objs:
            if o.type == "ARMATURE" or (o.type == "MESH" and o.parent is None):
                bpy.data.objects.remove(o)
    brows.name = brows.data.name = "hair_eyebrows"
    eyes.name = eyes.data.name = "eyes"

    front_sign = 1 if (sum((eyes.matrix_world @ v.co for v in eyes.data.vertices), Vector()) / len(eyes.data.vertices)).y > 0 else -1
    j = joints(arm)
    log("front", front_sign, {k: round(v, 3) for k, v in j.items()})

    bisect(body, cut_planes(j))
    seg = [segment_of(body.matrix_world @ p.center, j) for p in body.data.polygons]
    by_seg = {s: {i for i, x in enumerate(seg) if x == s} for s in SEGMENTS}
    log({k: len(v) for k, v in by_seg.items()})

    mats = {}
    for name, (segs, dist, relax, mat_name) in GARMENTS.items():
        g = extract(body, f"garment_{name}", set().union(*(by_seg[s] for s in segs)))
        g.data.materials.clear()
        mats[mat_name] = mats.get(mat_name) or new_material(mat_name, (0.5, 0.5, 0.5), rough=0.85)
        g.data.materials.append(mats[mat_name])
        if name == "shoes":
            mats[mat_name] = mats.get(mat_name) or new_material(mat_name, (0.5, 0.5, 0.5), rough=0.85)
            shoes = build_shoes(g, arm, front_sign, mats[mat_name])
            bpy.data.objects.remove(g)
            shoes.name = shoes.data.name = "garment_shoes"
            soles(shoes, new_material("M_Sole", (0.9, 0.9, 0.9), rough=0.7))
            log("garment", name, len(shoes.data.polygons))
            continue
        relax_and_push(g, dist, relax, j["arm_x"], flatten_below=0.02 if name == "shoes" else None)
        tailor(name, g, j)
        if name == "coat":
            # knee length, in three bands so the skirt bends with the legs
            for _ in range(3):
                extrude_hem(g, 0.15, 0.022)
            skirt_weights(g, body, j["waist_z"], 0.45 + 0.12)
            shirt = bpy.data.materials.get("M_Shirt") or new_material("M_Shirt", (0.9, 0.9, 0.9), rough=0.6)
            g.data.materials.append(shirt)
            shirt_front(g, front_sign, j["neck_z"])
            coat_details(g, arm, j, front_sign)
        elif name == "jacket":
            extrude_hem(g, 0.14, 0.045)
            g.data.materials.append(new_material("M_Shirt", (0.9, 0.9, 0.9), rough=0.6))
            shirt_front(g, front_sign, j["neck_z"])
            jacket_details(g, arm, j, front_sign)
        elif name in ("tank", "tee"):
            extrude_hem(g, 0.035, 0.012)
        elif name == "hoodie":
            extrude_hem(g, 0.06, 0.02)
            hoodie_details(g, arm, j, front_sign)
        elif name == "pants":
            belt(g, arm, j, front_sign)
        elif name == "shorts":
            band(g, j, new_material("M_Band", (0.9, 0.9, 0.9), rough=0.6))
        log("garment", name, len(g.data.polygons))

    for s_name, faces in by_seg.items():
        extract(body, f"body_{s_name}", faces)
    bpy.data.objects.remove(body)

    sunglasses(arm, eyes)
    glasses(arm, eyes)

    # Only position/normal/UV0/skin reach the GPU: the source meshes carry extra
    # colour sets and UV maps that push WebGPU past its 8 vertex-buffer limit.
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        me = o.data
        while me.color_attributes:
            me.color_attributes.remove(me.color_attributes[0])
        while len(me.uv_layers) > 1:
            me.uv_layers.remove(me.uv_layers[-1])

    # Keep textures light for mobile
    for img in bpy.data.images:
        if img.size[0] > TEX_SIZE:
            img.scale(TEX_SIZE, TEX_SIZE)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_animations=False,
        export_skins=True,
        export_morph=False,
        export_yup=True,
        export_image_format="WEBP",
        export_materials="EXPORT",
    )
    log("wrote", OUT, sorted(o.name for o in bpy.data.objects))


main()
