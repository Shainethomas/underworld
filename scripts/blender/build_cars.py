"""The game's cars, from Kenney's Car Kit (CC0, art-source/kenney-car-kit).

The kit's cars are toy-proportioned (about 2.5 long and 1.3 tall) and painted
from one shared colour-swatch texture. For the game each one is:

- resized to a real car: the body stretched to the target length, width and
  roof height, the wheels scaled evenly to the target radius (so they stay
  round) and moved out to where the stretched wheel arches are;
- turned so its front is +X in the exported file. Babylon's glTF loader
  mirrors X into its left-handed space, so in the game the nose points along
  local −X, as every set expects (`carFront` in the sets: yaw 0 points it at −X);
- split into proper materials by which swatch each face uses: glossy paint,
  smoked glass, headlamps, tail lamps, trim, underbody, plates, tyres and
  alloys. The material names are the ones the sets look for ('… lacquer',
  'smoked glass', 'headlamp glass', 'tail lamp glass').

Rebuild (then compress, as for every runtime GLB):

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_cars.py
  node scripts/compress-models.mjs public/assets/models/environment/{sedan,sedan_sports,suv,taxi,van}.glb
"""
import bpy, colorsys, math, os
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
KIT = os.path.join(ROOT, 'art-source/kenney-car-kit/Models/GLB format')
OUT = os.path.join(ROOT, 'public/assets/models/environment')
os.makedirs(OUT, exist_ok=True)

# name in the kit → file in the game, paint, and real size: length, width, roof height (m), wheel radius (m)
CARS = [
    # Rookie's car, and the city's default traffic
    dict(kit='sedan', out='sedan', paint=('sedan graphite lacquer', (.022, .028, .038)), size=(4.75, 1.85, 1.46, .36)),
    # the grey car at the rail yard (Scene 03); the kit's spoiler is left off
    dict(kit='sedan-sports', out='sedan_sports', paint=('sports gunmetal lacquer', (.16, .17, .18)), size=(4.7, 1.85, 1.36, .36), drop=('spoiler',)),
    # Victor's people: a big black luxury SUV
    dict(kit='suv-luxury', out='suv', paint=('suv black lacquer', (.012, .012, .014)), size=(5.0, 1.98, 1.8, .4)),
    # traffic
    dict(kit='taxi', out='taxi', paint=('taxi yellow lacquer', (.62, .38, .03)), size=(4.85, 1.85, 1.62, .36)),
    dict(kit='van', out='van', paint=('van grey lacquer', (.2, .22, .25)), size=(5.2, 1.98, 2.05, .38)),
]


def material(name, color, rough=.5, metal=0., coat=0.):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if coat:
        p.inputs['Coat Weight'].default_value = coat
        p.inputs['Coat Roughness'].default_value = .06
    return m


def kind(rgb, y, rear):
    """What a body face is, from its swatch colour and where it sits (y: Blender's length axis, front is −Y)."""
    r, g, b = rgb
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if r >= 250 and g >= 200 and b <= 65:
        return 'headlamp'
    if r > 200 and g < 90 and b < 70 and y > rear:
        return 'tail'
    if s < .045 and v > .9:
        return 'plate'
    if s < .17 and v > .93 and b >= r:
        return 'glass'
    if s > .4:
        return 'paint'
    if v < .32:
        return 'under'
    return 'trim'


def build(car):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(KIT, car['kit'] + '.glb'))
    img = next(iter(bpy.data.images))
    W, H = img.size
    px = img.pixels[:]

    def swatch(u, v):
        x = min(W - 1, max(0, int((u % 1) * W)))
        y = min(H - 1, max(0, int((v % 1) * H)))
        i = (y * W + x) * 4
        return tuple(round(c * 255) for c in px[i:i + 3])

    for name in car.get('drop', ()):
        for o in [o for o in bpy.context.scene.objects if o.name.startswith(name)]:
            bpy.data.objects.remove(o, do_unlink=True)

    paint_name, paint_color = car['paint']
    mats = {
        'paint': material(paint_name, paint_color, rough=.32, metal=.55, coat=1.),
        'glass': material('smoked glass', (.02, .028, .034), rough=.04, metal=.25),
        'headlamp': material('headlamp glass', (.85, .86, .8), rough=.12),
        'tail': material('tail lamp glass', (.38, .01, .015), rough=.15),
        'plate': material('number plate', (.62, .6, .55), rough=.6),
        'trim': material('bumper trim', (.035, .037, .042), rough=.55, metal=.2),
        'under': material('underbody', (.01, .011, .012), rough=.9),
        'tyre': material('tyre rubber', (.014, .015, .017), rough=.88),
        'alloy': material('brushed alloy', (.55, .57, .6), rough=.28, metal=.95),
    }
    keys = list(mats)

    L, Wd, Hr, R = car['size']
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    body = next(o for o in meshes if o.name.startswith('body'))
    # bake the import's transforms so everything is in Blender world space (Z up, front −Y)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
    sx = Wd / (max(p.x for p in bb) - min(p.x for p in bb))
    sy = L / (max(p.y for p in bb) - min(p.y for p in bb))
    sz = Hr / max(p.z for p in bb)
    ws = R / .3  # the kit's wheels are 0.6 across

    # the body: stretched about the ground point under its centre
    body.location = Vector((body.location.x * sx, body.location.y * sy, body.location.z * sz))
    body.scale = (sx, sy, sz)
    # the wheels: scaled evenly, centred where the stretched arches are, resting on the ground
    for o in meshes:
        if o is not body:
            o.location = Vector((o.location.x * sx, o.location.y * sy, R))
            o.scale = (ws, ws, ws)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # materials by swatch
    rear = max(p.y for p in bb) * sy * .75
    for o in meshes:
        me = o.data
        me.materials.clear()
        for k in keys:
            me.materials.append(mats[k])
        uv = me.uv_layers.active.data
        wheel = o is not body
        for p in me.polygons:
            u = sum(uv[l].uv[0] for l in p.loop_indices) / p.loop_total
            v = sum(uv[l].uv[1] for l in p.loop_indices) / p.loop_total
            rgb = swatch(u, v)
            if wheel:
                k = 'alloy' if colorsys.rgb_to_hsv(*[c / 255 for c in rgb])[2] > .45 else 'tyre'
            else:
                k = kind(rgb, (o.matrix_world @ p.center).y, rear)
            p.material_index = keys.index(k)
        while me.uv_layers:
            me.uv_layers.remove(me.uv_layers[0])

    # one object per car, its front turned from −Y to +X (−X once Babylon has mirrored it)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    car_obj = bpy.context.object
    car_obj.name = car['out']
    car_obj.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'Z') @ car_obj.matrix_world
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o is not car_obj:
            bpy.data.objects.remove(o, do_unlink=True)
    # drop materials no face uses
    used = {p.material_index for p in car_obj.data.polygons}
    for i in reversed(range(len(car_obj.data.materials))):
        if i not in used:
            car_obj.data.materials.pop(index=i)
    d = car_obj.dimensions
    print(f"[cars] {car['out']}: {d.x:.2f} long, {d.y:.2f} wide, {d.z:.2f} high; {[m.name for m in car_obj.data.materials]}")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, car['out'] + '.glb'), export_format='GLB', use_selection=True,
                              export_yup=True, export_materials='EXPORT', export_texcoords=False)


for c in CARS:
    build(c)
