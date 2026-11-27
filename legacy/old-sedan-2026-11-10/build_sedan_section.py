# The old hand-scripted sedan, removed from scripts/blender/build_environment_props.py on 2026-11-10
# (replaced by scripts/blender/build_cars.py, from Kenney's Car Kit). Needs that script's helpers to run.

# Executive sedan: a shaped steel body, recessed wheel wells and separate glazing.
clear()
paint=material('sedan graphite lacquer',(.022,.028,.038),.24,.62)
glass=material('smoked glass',(.035,.065,.085),.13,.3)
rubber=material('tyre rubber',(.012,.014,.016),.92)
chrome=material('brushed alloy',(.45,.48,.5),.25,.95)
black=material('grille recess',(.008,.01,.012),.65)
white=material('headlamp glass',(.8,.84,.72),.2)
red=material('tail lamp glass',(.42,.008,.012),.24)
body=hull('sedan body',[(-2.42,.73,.44,.79),(-2.2,.91,.38,.97),(-1.5,.94,.38,1.03),(.7,.94,.38,1.02),(1.85,.91,.4,.88),(2.4,.79,.48,.78)],paint,.075)
for x in [-1.5,1.55]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.4,depth=2.4,location=(x,0,.4),rotation=(math.pi/2,0,0));cut=bpy.context.object
    bpy.context.view_layer.objects.active=body;b=body.modifiers.new('Wheel well','BOOLEAN');b.operation='DIFFERENCE';b.object=cut;bpy.ops.object.modifier_apply(modifier=b.name);bpy.data.objects.remove(cut,do_unlink=True)
hull('cabin glazing',[(-1.45,.79,.98,1.05),(-.88,.72,1,1.55),(.52,.72,1,1.56),(1.22,.8,.98,1.05)],glass,.025)
box('roof',(1.45,1.5,.08),(-.17,0,1.56),paint,.06)
for side in [-1,1]:
    y=side*.78
    rod('A pillar',(.52,side*.72,1.56),(1.22,side*.8,1.02),.038,paint)
    rod('C pillar',(-.88,side*.72,1.53),(-1.45,side*.79,1.01),.055,paint)
    rod('B pillar',(-.18,side*.73,1.54),(-.18,side*.81,1.0),.035,paint)
    rod('window sill',(-1.45,y,1.015),(1.22,y,1.015),.018,chrome)
    box('side skirt',(3.7,.045,.075),(-.15,side*.94,.46),black,.018)
    for x in [-.62,.45]:
        box('door handle',(.19,.035,.032),(x,side*.95,.91),chrome,.014)
        rod('door shut line',(x-.35,side*.944,.53),(x-.35,side*.944,.99),.005,black)
    box('mirror',(.26,.18,.13),(.92,side*1.02,1.13),paint,.06)
    for x in [-1.5,1.55]:
        torus('tyre',.285,.095,(x,side*.91,.38),rubber,(0,1,0))
        cyl('alloy rim',.22,.04,(x,side*1.0,.38),chrome,(0,1,0))
        cyl('hub',.075,.055,(x,side*1.025,.38),black,(0,1,0))
        for a in range(8):
            ang=a*math.tau/8
            rod('rim spoke',(x+math.cos(ang)*.07,side*1.03,.38+math.sin(ang)*.07),(x+math.cos(ang)*.2,side*1.03,.38+math.sin(ang)*.2),.017,chrome)
    box('headlight',(.055,.42,.14),(2.37,side*.52,.73),white,.025)
    box('taillight',(.055,.43,.13),(-2.39,side*.48,.73),red,.025)
box('front grille',(.05,.65,.23),(2.4,0,.63),black,.015)
for y in range(-6,7):box('grille vane',(.055,.012,.19),(2.43,y*.045,.64),chrome,.003)
for x in [-2.42,2.43]:box('bumper trim',(.035,1.55,.035),(x,0,.5),chrome,.012)
box('rear plate',(.035,.42,.13),(-2.46,0,.62),white,.008)
export('sedan')
