"""Authored, bevelled environment props. Rebuild with Blender --background --python this_file."""
import bpy, math, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'public/assets/models/environment')
os.makedirs(OUT, exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def material(name, color, rough=.6, metal=0, leather=False):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if leather:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(os.path.join(ROOT,'art-source/environment-originals/leather_normal.jpg'),check_existing=True);n.image.colorspace_settings.name='Non-Color'
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.28
        m.node_tree.links.new(n.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
    return m

def finish(o,name,mat,bevel=0):
    o.name=name;o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=bevel;b.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
        n=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');n.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=n.name)
    for f in o.data.polygons:f.use_smooth=True
    return o

def box(name,dims,pos,mat,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=dims;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)

def cyl(name,r,depth,pos,mat,axis=None,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=pos);o=bpy.context.object
    if axis:o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    return finish(o,name,mat,min(.012,depth*.12))

def rod(name,a,b,r,mat):
    return cyl(name,r,(Vector(b)-Vector(a)).length,(Vector(a)+Vector(b))*.5,mat,Vector(b)-Vector(a),16)

def torus(name,major,minor,pos,mat,axis=(0,0,1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=10,location=pos,major_radius=major,minor_radius=minor)
    o=bpy.context.object;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler();return finish(o,name,mat)

def hull(name,rings,mat,bevel=.035):
    # Each ring runs around an X cross-section: bottom-left, bottom-right, top-right, top-left.
    verts=[]
    for x,w,low,high in rings: verts.extend([(x,-w,low),(x,w,low),(x,w,high),(x,-w,high)])
    faces=[(3,2,1,0)]
    for i in range(len(rings)-1):
        for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    faces.append(tuple(range((len(rings)-1)*4,len(rings)*4)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    # Correct normals independent of winding and assign useful UVs to bevelled props.
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.uv.smart_project();bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
    return finish(o,name,mat,bevel)

def export(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=85)

# The cars are built by build_cars.py (Kenney's Car Kit); the old scripted sedan is in legacy/old-sedan-2026-11-10/.

# Club chair: curved cushions, piping, tuft buttons, timber feet.
clear(); leather=material('oxblood leather',(.10,.024,.018),.57,leather=True); seam=material('leather piping',(.055,.012,.008),.66);wood=material('dark walnut',(.045,.022,.01),.48)
box('chair base',(1.05,.85,.2),(0,0,.24),wood,.05)
box('seat cushion',(.83,.72,.21),(0,-.04,.4),leather,.095)
back=box('back cushion',(.91,.22,.84),(0,.34,.83),leather,.095);back.rotation_euler.x=math.radians(-6)
for x in [-.49,.49]:
    box('rolled arm',(.24,.83,.41),(x,0,.62),leather,.11)
    for y in [-.31,.31]:cyl('turned foot',.055,.18,(x*.85,y,.09),wood)
for x in [-.27,0,.27]:
    for z in [.65,.88,1.1]:cyl('tuft button',.018,.012,(x,.215,z),seam,(0,-1,0),16)
for x in [-.39,.39]:rod('seat piping',(x,-.35,.43),(x,.25,.43),.008,seam)
export('club_chair')

# Leather heavy bag with rounded end caps, stitched straps and hanging hardware.
clear(); leather=material('bag charcoal leather',(.035,.03,.025),.68,leather=True);trim=material('bag seam',(.012,.01,.008),.8);steel=material('chain steel',(.27,.3,.32),.32,.8);label=material('badge cream',(.59,.53,.4),.88)
cyl('bag body',.215,1.03,(0,0,0),leather)
for z in [-.515,.515]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=12,radius=1,location=(0,0,z));o=bpy.context.object;o.scale=(.213,.213,.075);finish(o,'rounded end cap',leather)
    torus('welt seam',.211,.006,(0,0,z),trim)
for a in range(4):
    ang=a*math.tau/4
    x,y=math.cos(ang)*.19,math.sin(ang)*.19
    rod('leather hanger',(x,y,.38),(x*.8,y*.8,.64),.021,trim)
    rod('suspension chain',(x*.8,y*.8,.64),(0,0,.94),.009,steel)
box('stitched label',(.19,.012,.18),(0,-.216,.05),label,.007)
export('heavy_bag')
print('Environment props written to',OUT)
