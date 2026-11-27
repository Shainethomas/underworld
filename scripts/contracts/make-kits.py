# Builds the Pier Nine (docks) and Hollis Hill (estate) contract kits from the
# Calder Yard kit: the same beats, with each set's marks, shots and events.
# Rerun after changing kits/yard.staging.json:  python3 scripts/contracts/make-kits.py
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
KITS = os.path.join(ROOT, 'src/story/contracts/kits')
yard = json.load(open(os.path.join(KITS, 'yard.staging.json')))

SETS = {
  'docks': {
    'env': 'docks', 'place': 'Pier Nine', 'events': ['parcelBack'],
    'marks': {
      'car_side': 'car_side', 'car_door': 'car_side', 'gate_in': [1.6, -3.4],
      'nico_wait': 'sal_wait', 'nico_pace': 'sal_bench', 'meet': 'threshold',
      'boxcar_look': 'container_look', 'boxcar_stand': 'container_stand',
      'van_look': 'quay_edge', 'van_stand': 'quay_stand',
      # the muscle comes out of the back of the warehouse; the fight is in the doorway
      'sedan_lean': [1.4, 17.4], 'boxcar_end': [1.4, 16.8], 'office_door': 'sal_wait',
      'rookie_stop': [1.0, 10.6], 'block': [0.1, 11.6],
      'fight_rookie': [1.0, 10.6], 'fight_stranger': [0.1, 11.5],
    },
    'cams': {
      'yard_wide': 'dock_wide', 'yard_car': 'dock_wide', 'yard_meet': 'dock_door',
      'block_side': 'dock_pair', 'gate_out': 'dock_wide',
    },
  },
  'estate': {
    'env': 'estate', 'place': 'Hollis Hill', 'events': [],
    'marks': {
      'car_side': 'car_door', 'car_door': 'car_door', 'gate_in': 'drive_mid',
      'nico_wait': 'door_guard', 'nico_pace': 'door_guard2', 'meet': 'delivery_stand',
      'boxcar_look': 'fountain', 'boxcar_stand': 'fountain_stand',
      'van_look': 'house_car', 'van_stand': 'house_car_stand',
      # the muscle comes round from the side of the house; the fight is at the foot of the steps
      # (centred in steps_side; the contact steps back to the left of the steps)
      'sedan_lean': 'guard_stairs', 'boxcar_end': 'guard_stairs', 'office_door': [-2.4, 24.2],
      'rookie_stop': [1.6, 21.8], 'block': [0.8, 22.6],
      'fight_rookie': [1.6, 21.8], 'fight_stranger': [0.8, 22.6],
    },
    'cams': {
      'yard_wide': 'estate_crane', 'yard_car': 'car_side_out', 'yard_meet': 'steps_side',
      'block_side': 'steps_side', 'gate_out': 'drive_down',
    },
  },
}

def walk(v, conf):
  if isinstance(v, dict):
    out = {}
    for k, x in v.items():
      if k == 'cam' and isinstance(x, str):
        out[k] = conf['cams'].get(x, x)
      elif k == 'env' and isinstance(x, list):
        out[k] = [e for e in x if e in conf['events']]
      elif k == 'env' and isinstance(x, str) and x == 'yard':
        out[k] = conf['env']
      elif k == 'env' and isinstance(x, str):
        if x in conf['events']: out[k] = x
      elif k in ('patrol',):
        out[k] = [conf['marks'].get(p, p) if isinstance(p, str) else p for p in x]
      else:
        out[k] = walk(x, conf)
    return out
  if isinstance(v, list):
    return [walk(x, conf) for x in v]
  if isinstance(v, str) and v in conf['marks']:
    return conf['marks'][v]
  return v

for name, conf in SETS.items():
  beats = walk(yard['beats'], conf)
  # the yard's arrival walks through the gate; elsewhere the walk is to the set's own mark
  kit = {'kit': {'env': conf['env'], 'place': conf['place'], 'contact': '@contact', 'heavy': '@heavy'}, 'beats': beats}
  with open(os.path.join(KITS, f'{name}.staging.json'), 'w') as f:
    json.dump(kit, f, indent=1)
  print('wrote', name)
