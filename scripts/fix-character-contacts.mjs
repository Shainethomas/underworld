// Bake hand/body contacts into existing rigs. No runtime IK, added meshes,
// textures, bones or animation layers. Run before compress-models/make-mobile-assets.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, resample, prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { statSync } from 'node:fs'
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder})
const files=process.argv.slice(2)
if(!files.length) files.push('public/assets/models/rookie.glb','public/assets/models/mobile/rookie.glb')
for(const file of files){
 if(!/(^|\/)rookie\.glb$/.test(file)){console.log(file,'contact fitting is specific to Rookie; unchanged');continue}
 const size=statSync(file).size,doc=await io.read(file),root=doc.getRoot()
 if(root.getExtras().contactPoses===3){console.log(file,'already fitted');continue}
 const nodes=new Map(root.listNodes().map(n=>[n.getName(),n])),rest=new Map(root.listNodes().map(n=>[n,{t:n.getTranslation(),q:n.getRotation(),s:n.getScale()}]))
 const buffer=root.listBuffers()[0]
 const pos=name=>Vector3.FromArray(nodes.get(name).getWorldTranslation())
 const world=name=>Matrix.FromArray(nodes.get(name).getWorldMatrix())
 const worldQ=name=>{const q=new Quaternion();world(name).decompose(undefined,q);return q}
 const wristLocal = Vector3.TransformNormal(new Vector3(-.115,-.10,.025), world('Head').invert())
 const setWorldQ=(name,q)=>{
  const n=nodes.get(name),m=new Matrix();q.toRotationMatrix(m)
  const parent=n.getParentNode();if(parent)m.multiplyToRef(Matrix.FromArray(parent.getWorldMatrix()).invert(),m)
  const local=new Quaternion();m.decompose(undefined,local);n.setRotation(local.normalize().asArray())
 }
 const turn=(name,from,to)=>{const d=new Quaternion();Quaternion.FromUnitVectorsToRef(from.normalize(),to.normalize(),d);const m=new Matrix();d.toRotationMatrix(m);const q=new Quaternion();world(name).multiply(m).decompose(undefined,q);setWorldQ(name,q)}
 const ik=(up,lo,hand,target)=>{
  const a=pos(up),b=pos(lo),c=pos(hand),q=worldQ(hand),l1=Vector3.Distance(a,b),l2=Vector3.Distance(b,c)
  const axis=target.subtract(a).normalize(),d=Math.min(Vector3.Distance(a,target),(l1+l2)*.995)
  const projection=(l1*l1+d*d-l2*l2)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-projection*projection))
  const bend=b.subtract(a);bend.subtractInPlace(axis.scale(Vector3.Dot(bend,axis)))
  if(bend.lengthSquared()<1e-8) bend.set(0,0,1)
  const elbow=a.add(axis.scale(projection)).add(bend.normalize().scale(height))
  turn(up,b.subtract(a),elbow.subtract(a))
  turn(lo,pos(hand).subtract(pos(lo)),a.add(axis.scale(d)).subtract(pos(lo)))
  setWorldQ(hand,q)
 }
 const sample=(clip,time)=>{
  for(const [n,r] of rest){n.setTranslation(r.t);n.setRotation(r.q);n.setScale(r.s)}
  for(const ch of clip.listChannels()){
   const s=ch.getSampler(),input=s.getInput(),output=s.getOutput(),times=input.getArray();let i=0
   while(i+1<times.length&&times[i+1]<=time)i++
   const j=Math.min(i+1,times.length-1),k=i===j?0:Math.max(0,Math.min(1,(time-times[i])/(times[j]-times[i])))
   const a=output.getElement(i,[]),b=output.getElement(j,[]),n=ch.getTargetNode()
   if(ch.getTargetPath()==='rotation')n.setRotation(Quaternion.Slerp(Quaternion.FromArray(a),Quaternion.FromArray(b),k).normalize().asArray())
   else if(ch.getTargetPath()==='translation')n.setTranslation(a.map((v,c)=>v+(b[c]-v)*k))
   else if(ch.getTargetPath()==='scale')n.setScale(a.map((v,c)=>v+(b[c]-v)*k))
  }
 }
 const acc=(type,data)=>doc.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(data))
 function baked(sourceName,name,fit,{staticPose=false,dirty=null}={}){
  const source=root.listAnimations().find(a=>a.getName()===sourceName)
  if(!source)throw new Error(`Missing ${sourceName}`)
  const end=Math.max(...source.listSamplers().map(s=>s.getInput().getMax([])[0]))
  const times=staticPose?[0,1]:Array.from({length:Math.ceil(end*20)+1},(_,i)=>Math.min(end,i/20))
  if(!staticPose)times[times.length-1]=end
  const tracks=source.listChannels().map(ch=>({node:ch.getTargetNode(),path:ch.getTargetPath(),input:ch.getSampler().getInput(),output:ch.getSampler().getOutput(),interpolation:ch.getSampler().getInterpolation()}))
  const data=new Map()
  for(let i=0;i<times.length;i++){
   sample(source,staticPose?0:times[i]);fit(i,times[i])
   for(const ch of source.listChannels()){
    const n=ch.getTargetNode(),path=ch.getTargetPath(),key=n.getName()+'|'+path
    if(dirty && !dirty.has(n.getName()))continue
    if(!data.has(key))data.set(key,{node:n,path,values:[]})
    data.get(key).values.push(...(path==='rotation'?n.getRotation():path==='translation'?n.getTranslation():n.getScale()))
   }
  }
  // Replace the phone clip in place; carry/sleep clips reuse the same rig.
  const clip=name===sourceName?source:doc.createAnimation(name)
  if(clip===source){for(const c of [...clip.listChannels()])c.dispose();for(const s of [...clip.listSamplers()])s.dispose()}
  for(const t of (name.startsWith('Carry_') ? [] : tracks)){
   if(!dirty || dirty.has(t.node.getName()))continue
   const sampler=doc.createAnimationSampler().setInterpolation(t.interpolation).setInput(t.input).setOutput(t.output)
   clip.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(t.node).setTargetPath(t.path).setSampler(sampler))
  }
  const input=acc('SCALAR',times)
  for(const {node,path,values} of data.values()){
   const s=doc.createAnimationSampler().setInterpolation('LINEAR').setInput(input).setOutput(acc(path==='rotation'?'VEC4':'VEC3',values))
   clip.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s))
  }
 }
 const curl=(side,radians)=>{
  for(const finger of ['index','middle','ring','pinky'])for(let j=1;j<=3;j++){
   const n=nodes.get(`${finger}_0${j}_${side}`);if(!n)continue
   const angle=j===1?radians*.65:radians
   n.setRotation(Quaternion.FromArray(n.getRotation()).multiply(Quaternion.RotationAxis(Vector3.Forward(),angle)).normalize().asArray())
  }
 }
 // Palm closes around a small handle; the shoulder remains relaxed and the
 // wrist clears the thigh. The source's breathing/left arm remain animated.
 for(const [base,name] of [['Idle_Loop','Carry_Idle_Loop'],['Walk_Loop','Carry_Walk_Loop']]){
  baked(base,name,()=>{
   const hip=pos('pelvis');ik('upperarm_r','lowerarm_r','hand_r',hip.add(new Vector3(-.30,.015,.03)))
   curl('r',.85)
  },{dirty:new Set(['upperarm_r','lowerarm_r','hand_r',...['index','middle','ring','pinky'].flatMap(f=>[1,2,3].map(j=>`${f}_0${j}_r`))])})
 }
 baked('Idle_TalkingPhone_Loop','Idle_TalkingPhone_Loop',()=>{
  const head=pos('Head');ik('upperarm_r','lowerarm_r','hand_r',head.add(Vector3.TransformNormal(wristLocal,world('Head'))))
 },{dirty:new Set(['upperarm_r','lowerarm_r','hand_r'])})
 // Fit the held entry of the existing get-up, blending back into its
 // original movement over 0.3s. No extra sleep clip/group or animation layer.
 baked('LayToIdle','LayToIdle',(_i,t)=>{
  const k = t <= .04 ? 1 : Math.max(0, (.30 - t) / .26)
  if (!k) return
  const hip=pos('pelvis')
  const fit=(up,lo,end,offset)=>ik(up,lo,end,Vector3.Lerp(pos(end),hip.add(offset),k))
  fit('thigh_l','calf_l','foot_l',new Vector3(.10,-.015,.73))
  fit('thigh_r','calf_r','foot_r',new Vector3(-.11,-.005,.76))
  fit('upperarm_r','lowerarm_r','hand_r',new Vector3(-.05,.20,-.17))
  fit('upperarm_l','lowerarm_l','hand_l',new Vector3(.20,.025,-.06))
  const delta=Quaternion.RotationAxis(Vector3.Forward(),.55*k),m=new Matrix();delta.toRotationMatrix(m)
  const q=new Quaternion();world('Head').multiply(m).decompose(undefined,q);setWorldQ('Head',q)
 },{dirty:new Set(['thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l','Head'])})

 for(const [n,r] of rest){n.setTranslation(r.t);n.setRotation(r.q);n.setScale(r.s)}
 root.setExtras({...root.getExtras(),contactPoses:3})
 await doc.transform(resample({tolerance:5e-4}),dedup(),prune())
 // Store repeated constant tracks once. The loader fans out references at
 // spawn, not layers at render time. This offsets the added contact data.
 const constants = new Map()
 for (const anim of root.listAnimations()) for (const ch of anim.listChannels()) {
  const output=ch.getSampler().getOutput(), value=output.getElement(0,[])
  let constant=true
  for(let i=1;i<output.getCount()&&constant;i++) {
   const v=output.getElement(i,[])
   constant=v.every((x,j)=>Math.abs(x-value[j])<1e-4)
  }
  if(!constant)continue
  const key=ch.getTargetNode().getName()+'|'+ch.getTargetPath()
  if(!constants.has(key))constants.set(key,new Map())
  const variants=constants.get(key), hash=value.map(x=>x.toFixed(4)).join(',')
  if(!variants.has(hash))variants.set(hash,{node:ch.getTargetNode(),path:ch.getTargetPath(),value,channels:[]})
  variants.get(hash).channels.push({anim,ch})
 }
 const templates=doc.createAnimation('Contact_Rest'), zero=acc('SCALAR',[0])
 let packed=0
 for(const variants of constants.values()) {
  const best=[...variants.values()].sort((a,b)=>b.channels.length-a.channels.length)[0]
  if(best.channels.length<2)continue
  const sampler=doc.createAnimationSampler().setInterpolation('LINEAR').setInput(zero).setOutput(acc(best.path==='rotation'?'VEC4':'VEC3',best.value))
  templates.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(best.node).setTargetPath(best.path).setSampler(sampler))
  for(const {anim,ch} of best.channels)if(anim.listChannels().length>1){ch.dispose();packed++}
 }
 for(const anim of root.listAnimations()) {
  const used=new Set(anim.listChannels().map(c=>c.getSampler()))
  for(const sampler of [...anim.listSamplers()])if(!used.has(sampler))sampler.dispose()
 }
 await doc.transform(prune(),dedup())
 console.log(`${file}: shared ${packed} constant tracks`)
 // Match the existing pipeline's normalized int16 animation rotations.
 for(const anim of root.listAnimations())for(const ch of anim.listChannels()){
  const a=ch.getSampler().getOutput()
  if(ch.getTargetPath()!=='rotation' || a.getNormalized())continue
  const data=a.getArray(),q=new Int16Array(data.length)
  for(let i=0;i<data.length;i++)q[i]=Math.round(Math.max(-1,Math.min(1,data[i]))*32767)
  a.setArray(q).setNormalized(true)
 }
 await io.write(file,doc)
 console.log(`${file}: ${size} -> ${statSync(file).size} bytes; baked carry, phone and resting contacts`)
}
