"""Build GhostPilot's clickable crew body in Blender: public/models/body.glb + body.json.

Run headless:
    blender -b --factory-startup -P scripts/blender/build_body.py -- <repo root>
or inside a live Blender session (Blender MCP execute_code) with REPO set.

Source anatomy: the MakeHuman "hm08" base mesh, its macro targets and its default rig weights.
Since September 2020 these are released under CC0. They are read straight out of the MPFB 2
extension archive, downloaded from extensions.blender.org and checked against its SHA-256. No
add-on is installed or run: this script parses the mesh, target and weight files itself.

Posture: NASA Human Integration Design Handbook (NASA/SP-2010-3407/REV1), Figure 4.3-2
"Neutral Body Posture in 0g": head 24 deg forward, shoulder flexion 36 deg, elbow 122 deg,
trunk-thigh 128 deg, knee 133 deg, foot 111 deg to the torso line.

Personalisation: every shape is posed with its own fitted skeleton, and the posed difference
from the reference body is exported as a glTF morph target. The app blends them from the crew
profile (sex, height, mass, build) and from days in flight, with Table 4.3-4 "Anthropometric
Changes in 0g": +3% stature from spinal elongation, and the fluid shift that thins the legs,
fills the upper torso and puffs the face.

Body scan: every basis shape is also rendered as camera frames in the scan pose (.cache/scan-frames,
skip with SCAN_RENDER=0). scripts/calibrate-scan.mjs measures them with the app's MediaPipe model and
writes src/body-calibration.mjs.
"""
import gzip
import hashlib
import json
import math
import os
import sys
import urllib.request
import zipfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

REPO = os.path.abspath(globals().get('REPO') or (sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.getcwd()))
OUT = os.path.join(REPO, 'public', 'models', 'body.glb')
META = os.path.join(REPO, 'public', 'models', 'body.json')
MPFB_URL = ('https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/'
            'add-on-mpfb-v2.0.18.zip?repository=%2Fapi%2Fv1%2Fextensions%2F&blender_version_min=4.2.0')
MPFB_SHA = 'c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad'
MPFB_ZIP = os.environ.get('MPFB_ZIP') or os.path.join(REPO, '.cache', 'mpfb-2.0.18.zip')

# Reference crew member: male, about 35 years old (MakeHuman age 0.5 = 25 y, 1.0 = 90 y),
# a little more muscle than average (daily exercise is mandatory on the ISS), average weight, mixed ancestry, slightly idealised proportions.
REFERENCE = {'gender': 1.0, 'age': 0.58, 'muscle': 0.6, 'weight': 0.5, 'proportions': 0.6,
             'height': 0.5, 'cupsize': 0.5, 'firmness': 0.5,
             'race': {'african': 1 / 3, 'asian': 1 / 3, 'caucasian': 1 / 3}}


# ------------------------------------------------------------------ MakeHuman data
def mpfb_archive():
    if not os.path.exists(MPFB_ZIP):
        os.makedirs(os.path.dirname(MPFB_ZIP), exist_ok=True)
        request = urllib.request.Request(MPFB_URL, headers={'User-Agent': 'ghostpilot-build'})
        with urllib.request.urlopen(request, timeout=300) as response, open(MPFB_ZIP, 'wb') as out:
            out.write(response.read())
    digest = hashlib.sha256(open(MPFB_ZIP, 'rb').read()).hexdigest()
    if digest != MPFB_SHA:
        raise RuntimeError(f'MPFB archive checksum mismatch: {digest}')
    return zipfile.ZipFile(MPFB_ZIP)


def to_blender(a):
    """MakeHuman OBJ space (decimetres, Y up, +Z forward) to Blender metres (Z up, -Y forward)."""
    a = np.asarray(a, dtype=np.float64)
    return np.stack([a[..., 0], -a[..., 2], a[..., 1]], axis=-1) * 0.1


class MakeHuman:
    def __init__(self, archive):
        self.z = archive
        verts, faces, group = [], [], None
        for line in self.read('3dobjs/base.obj').decode().splitlines():
            if line.startswith('v '):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('g '):
                group = line[2:].strip()
            elif line.startswith('f ') and group == 'body':
                faces.append([int(p.split('/')[0]) - 1 for p in line.split()[1:]])
        self.base = to_blender(verts)
        self.faces = faces
        self.body_count = 1 + max(max(f) for f in faces)
        self.groups = json.loads(self.read('mesh_metadata/basemesh_vertex_groups.json'))
        self.macro = json.loads(self.read('targets/macrodetails/macro.json'))['macrotargets']
        self.rig = json.loads(self.read('rigs/standard/rig.default.json'))
        weights = json.loads(self.read('rigs/standard/weights.default.json'))['weights']
        self.weights = {b: (np.array([i for i, _ in w], dtype=np.int64), np.array([x for _, x in w]))
                        for b, w in weights.items()}
        self.targets = {}

    def read(self, name):
        return self.z.read('data/' + name)

    def group(self, name):
        return np.concatenate([np.arange(a, b + 1) for a, b in self.groups[name]])

    def target(self, name):
        if name not in self.targets:
            path = f'targets/{name}.target.gz'
            idx, delta = [], []
            try:
                text = gzip.decompress(self.read(path)).decode()
            except KeyError:
                text = ''
            for line in text.splitlines():
                if line and not line.startswith('#'):
                    p = line.split()
                    idx.append(int(p[0]))
                    delta.append([float(x) for x in p[1:4]])
            self.targets[name] = (np.array(idx, dtype=np.int64), to_blender(delta) if delta else np.zeros((0, 3)))
        return self.targets[name]

    def components(self, name, value):
        out = []
        for part in self.macro[name]['parts']:
            if part['lowest'] < value < part['highest']:
                pos = (value - part['lowest']) / (part['highest'] - part['lowest'])
                if part['low']:
                    out.append((part['low'], 1 - pos))
                if part['high']:
                    out.append((part['high'], pos))
        return out

    def stack(self, m, cutoff=0.001):
        """The same macro target stack MPFB computes (TargetService.calculate_target_stack...)."""
        c = {k: self.components(k, m[k]) for k in ('gender', 'age', 'muscle', 'weight', 'proportions', 'height', 'cupsize', 'firmness')}
        out = []
        for race, rw in m['race'].items():
            for a, aw in c['age']:
                for g, gw in c['gender']:
                    out.append((f'macrodetails/{race}-{g}-{a}', rw * gw * aw))
        for g, gw in c['gender']:
            for a, aw in c['age']:
                for mu, mw in c['muscle']:
                    for w, ww in c['weight']:
                        base = gw * aw * mw * ww
                        out.append((f'macrodetails/universal-{g}-{a}-{mu}-{w}', base))
                        for h, hw in c['height']:
                            out.append((f'macrodetails/height/{g}-{a}-{mu}-{w}-{h}', base * hw))
                        for p, pw in c['proportions']:
                            out.append((f'macrodetails/proportions/{g}-{a}-{mu}-{w}-{p}', base * pw))
                        if g == 'female':
                            for cu, cw in c['cupsize']:
                                for f, fw in c['firmness']:
                                    name = f'breast/female-{a}-{mu}-{w}-{cu}-{f}'
                                    if 'averagecup-averagefirmness' not in name:
                                        out.append((name, aw * mw * ww * cw * fw))
        return [(n, w) for n, w in out if w > cutoff]

    def shape(self, macro, extra=()):
        co = self.base.copy()
        for name, w in list(self.stack(macro)) + list(extra):
            idx, delta = self.target(name)
            if len(idx):
                co[idx] += w * delta
        return co


# ------------------------------------------------------------------ skeleton and posture
def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def mirror(v):
    return np.array([-v[0], v[1], v[2]])


def deg(a):
    return math.radians(a)


# NASA HIDH Figure 4.3-2, expressed as world directions for the left side (+X, front is -Y).
# Side view angles are from the body-centred vertical; front view angles from the same line.
UPPERARM = unit([math.tan(deg(51)), -math.tan(deg(36)), -1.0])         # 36 deg flexion; 39 deg below horizontal from the front
FOREARM_ELBOW = 122                                                    # included elbow angle
THIGH = unit([math.tan(deg(6)), -math.tan(deg(180 - 128)), -1.0])      # trunk-thigh 128 deg
SHANK_KNEE = 133                                                       # included knee angle
FOOT_TO_TORSO = 111                                                    # foot line to torso line
HEAD_FORWARD = 24                                                      # head line from vertical


def forearm_dir(upper):
    """Forearm in the plane of the upper arm and the forward axis, closing the elbow to 122 deg."""
    fwd = np.array([-0.18, -1.0, 0.0])
    axis = unit(np.cross(upper, fwd))
    angle = deg(180 - FOREARM_ELBOW)
    m = Matrix.Rotation(angle, 3, Vector(axis))
    return unit(np.array(m @ Vector(upper)))


def shank_dir(thigh):
    """Shank rotated back from the thigh by the knee flexion (180 - 133 deg), toes slightly in."""
    axis = unit(np.cross(thigh, [0, 0, -1]))
    m = Matrix.Rotation(deg(180 - SHANK_KNEE), 3, Vector(axis))
    s = np.array(m @ Vector(thigh))
    s[0] -= 0.14
    return unit(s)


def posture():
    up = UPPERARM
    fore = forearm_dir(up)
    hand = unit(fore + np.array([0.08, 0.0, -0.55]))
    thigh = THIGH
    aims = {
        'upperarm01.L': up, 'lowerarm01.L': fore, 'wrist.L': hand,
        'upperleg01.L': thigh, 'lowerleg01.L': shank_dir(thigh),
        'neck01': unit([0, -math.sin(deg(HEAD_FORWARD * 0.4)), math.cos(deg(HEAD_FORWARD * 0.4))]),
        'head': unit([0, -math.sin(deg(HEAD_FORWARD)), math.cos(deg(HEAD_FORWARD))]),
    }
    for name in list(aims):
        if name.endswith('.L'):
            aims[name[:-2] + '.R'] = mirror(aims[name])
    curls = {}
    for side in ('L', 'R'):
        for f in range(2, 6):
            for seg, a in ((1, 14), (2, 20), (3, 14)):
                curls[f'finger{f}-{seg}.{side}'] = a + 3 * (f - 2)
        curls[f'finger1-2.{side}'] = 12
        curls[f'finger1-3.{side}'] = 10
    # Foot: plantar flexed until the foot line sits 111 deg from the torso line (90 deg standing).
    flex = {f'foot.{side}': ((1.0, 0.0, 0.0), FOOT_TO_TORSO - 90) for side in ('L', 'R')}
    return aims, curls, flex


AIM_CHILD = {'upperarm01': 'lowerarm01', 'lowerarm01': 'wrist', 'upperleg01': 'lowerleg01', 'lowerleg01': 'foot'}


class Skeleton:
    def __init__(self, mh, co):
        self.mh = mh
        self.bones = mh.rig
        self.order = []
        seen = set()

        def visit(b):
            if b in seen:
                return
            parent = self.bones[b].get('parent')
            if parent:
                visit(parent)
            seen.add(b)
            self.order.append(b)
        for b in self.bones:
            visit(b)
        self.head, self.tail, self.rest = {}, {}, {}
        for b, spec in self.bones.items():
            self.head[b] = self.point(spec['head'], co)
            self.tail[b] = self.point(spec['tail'], co)
            axis = Vector(self.tail[b] - self.head[b])
            m3 = bpy.types.Bone.MatrixFromAxisRoll(axis, spec.get('roll', 0.0))
            self.rest[b] = np.array(m3)

    def point(self, spec, co):
        s = spec['strategy']
        if s == 'CUBE':
            return co[self.mh.group(spec['cube_name'])].mean(axis=0)
        if s == 'VERTEX':
            return co[spec['vertex_index']].copy()
        if s == 'MEAN':
            return co[spec['vertex_indices']].mean(axis=0)
        return np.array(spec['default_position'])

    def pose(self, aims, curls, flex, stretch=0.0):
        """World deform matrices. stretch: metres of spinal elongation spread over spine05..spine01."""
        spine = ['spine05', 'spine04', 'spine03', 'spine02', 'spine01']
        spine_len = sum(np.linalg.norm(self.tail[b] - self.head[b]) for b in spine)
        chain, deform = {}, {}
        for b in self.order:
            parent = self.bones[b].get('parent')
            c = chain[parent].copy() if parent else np.eye(4)
            h = c[:3, :3] @ self.head[b] + c[:3, 3]
            t = c[:3, :3] @ self.tail[b] + c[:3, 3]
            if b in aims:
                # Aim the joint-to-joint line (hip to knee, shoulder to elbow), not the bone's own tail.
                child = AIM_CHILD.get(b.split('.')[0])
                if child:
                    side = b[b.index('.'):] if '.' in b else ''
                    target = self.head[child + side]
                    t = c[:3, :3] @ target + c[:3, 3]
                r = np.array(Vector(unit(t - h)).rotation_difference(Vector(aims[b])).to_matrix())
                c = about(h, r) @ c
            if b in flex:
                axis, angle = flex[b]
                c = about(h, np.array(Matrix.Rotation(deg(angle), 3, Vector(axis)))) @ c
            if b in curls:
                xaxis = c[:3, :3] @ self.rest[b][:, 0]
                r = np.array(Matrix.Rotation(deg(curls[b]), 3, Vector(xaxis)))
                c = about(h, r) @ c
            d = c
            if stretch and b in spine:
                k = 1 + stretch / spine_len
                axis = unit(c[:3, :3] @ (self.tail[b] - self.head[b]))
                s = np.eye(3) + (k - 1) * np.outer(axis, axis)
                d = about(h, s) @ c
                t_now = c[:3, :3] @ self.tail[b] + c[:3, 3]
                shift = (k - 1) * (t_now - h)
                c = translate(shift) @ c
            chain[b], deform[b] = c, d
        return deform

    def skin(self, co, deform):
        out = np.zeros_like(co)
        total = np.zeros(len(co))
        for b, (idx, w) in self.mh.weights.items():
            m = deform[b]
            out[idx] += w[:, None] * (co[idx] @ m[:3, :3].T + m[:3, 3])
            total[idx] += w
        has = total > 1e-6
        out[has] /= total[has, None]
        out[~has] = co[~has]
        return out


def about(p, r3):
    m = np.eye(4)
    m[:3, :3] = r3
    m[:3, 3] = p - r3 @ p
    return m


def translate(v):
    m = np.eye(4)
    m[:3, 3] = v
    return m


# ------------------------------------------------------------------ regions
def bone_region(b):
    side = '_l' if b.endswith('.L') else '_r'
    if b.startswith(('finger', 'metacarpal', 'wrist')):
        return 'hand' + side
    if b.startswith(('upperarm', 'lowerarm', 'shoulder01')):
        return 'arm' + side
    if b.startswith(('upperleg', 'lowerleg', 'foot', 'toe')):
        return 'leg' + side
    if b in ('spine01', 'spine02') or b.startswith(('breast', 'clavicle')):
        return 'chest'
    if b in ('spine03', 'spine04'):
        return 'abdomen'
    if b in ('root', 'spine05') or b.startswith('pelvis'):
        return 'pelvis'
    return 'head'


def vertex_regions(mh):
    """Per-vertex region: the region whose bones carry the most total weight."""
    n = mh.body_count
    names = sorted({bone_region(b) for b in mh.weights})
    total = {r: np.zeros(n) for r in names}
    for b, (idx, w) in mh.weights.items():
        keep = idx < n
        np.add.at(total[bone_region(b)], idx[keep], w[keep])
    stack = np.stack([total[r] for r in names])
    return np.array(names, dtype=object)[stack.argmax(axis=0)], total


def face_regions(mh, vreg, totals, co, skeleton):
    """Limbs and head by summed rig weight; torso bands cut by anatomical planes in the rest pose."""
    faces = mh.faces
    centre = np.array([co[f].mean(axis=0) for f in faces])
    limb = lambda r: np.array([totals[r][f].mean() for f in faces])
    freg = np.array(['abdomen'] * len(faces), dtype=object)
    z_chest = skeleton.head['spine02'][2] + 0.01        # lower ribcage
    z_pelvis = skeleton.head['spine04'][2] - 0.015      # iliac crest
    spine_y = skeleton.head['spine03'][1]
    freg[centre[:, 2] > z_chest] = 'chest'
    freg[centre[:, 2] <= z_pelvis] = 'pelvis'
    freg[(freg == 'abdomen') & (centre[:, 1] > spine_y + 0.03)] = 'pelvis'   # lower back joins Back & pelvis
    for side, s in (('L', '_l'), ('R', '_r')):
        leg = limb('leg' + s)
        freg[leg > 0.5] = 'leg' + s
        shoulder, elbow = skeleton.head[f'upperarm01.{side}'], skeleton.head[f'lowerarm01.{side}']
        axis = unit(elbow - shoulder)
        armish = limb('arm' + s) + limb('hand' + s)
        freg[((centre - shoulder) @ axis > -0.03) & (armish > 0.08)] = 'arm' + s
        freg[limb('hand' + s) > 0.5] = 'hand' + s
    # Neck cut: a plane through the neck joint, lower at the throat than at the nape.
    neck = skeleton.head['neck01']
    normal = unit([0, -0.4, 1])
    freg[((centre - neck) @ normal > 0.0) & (np.abs(centre[:, 0]) < 0.11)] = 'head'
    freg[limb('head') > 0.6] = 'head'
    freg = list(freg)
    # Smooth ragged seams: a face whose edge neighbours mostly disagree takes their region.
    edge_faces = {}
    for k, f in enumerate(faces):
        for a, b in zip(f, f[1:] + f[:1]):
            edge_faces.setdefault((min(a, b), max(a, b)), []).append(k)
    neigh = [[] for _ in faces]
    for fs in edge_faces.values():
        for a in fs:
            neigh[a].extend(x for x in fs if x != a)
    for _ in range(4):
        changed = 0
        new = list(freg)
        for k in range(len(faces)):
            names = [freg[j] for j in neigh[k]]
            if not names:
                continue
            top = max(set(names), key=names.count)
            if top != freg[k] and names.count(top) > len(names) / 2 and names.count(freg[k]) <= 1:
                new[k] = top
                changed += 1
        freg = new
        if not changed:
            break
    return freg


# ------------------------------------------------------------------ 0g fluid shift (HIDH Table 4.3-4)
def fluid_shift(mh, co, vreg, skeleton):
    """Lower limbs thinner (-6% circumference), upper torso fuller (+2%), face fuller (+2.5 mm)."""
    out = co.copy()
    n = mh.body_count

    def radial(indices, a, b, factor):
        p = co[indices]
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        foot = a + t[:, None] * ab
        out[indices] = foot + (p - foot) * factor

    for side in ('L', 'R'):
        s = '_l' if side == 'L' else '_r'
        legs = np.where(vreg[:n] == 'leg' + s)[0]
        hip, knee = skeleton.head[f'upperleg01.{side}'], skeleton.head[f'lowerleg01.{side}']
        ankle = skeleton.head[f'foot.{side}']
        upper = legs[co[legs, 2] > knee[2]]
        lower = legs[(co[legs, 2] <= knee[2]) & (co[legs, 2] > ankle[2])]
        radial(upper, hip, knee, 0.94)
        radial(lower, knee, ankle, 0.94)
    chest = np.where(vreg[:n] == 'chest')[0]
    radial(chest, skeleton.head['spine02'], skeleton.tail['spine01'], 1.02)
    head = np.where(vreg[:n] == 'head')[0]
    centre = skeleton.head['head']
    face = head[(co[head, 1] < centre[1] - 0.02) & (co[head, 2] < skeleton.tail['head'][2] - 0.06)]
    outward = co[face] - centre
    outward /= np.linalg.norm(outward, axis=1)[:, None]
    out[face] += outward * 0.0025
    return out


# ------------------------------------------------------------------ build
def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.curves):
        for item in list(block):
            block.remove(item)


def build_regions(mh, freg, basis, absolute, joint, joint_tail):
    """One skin with every morph, cut along anatomical planes, then separated into region meshes.

    Cutting the whole skin keeps seams straight (a quad mesh split by whole faces steps), lets
    bisect interpolate every shape key at the new edges, and keeps one set of smooth normals
    across the seams.
    """
    n = mh.body_count
    names = sorted(set(freg) | {'chest', 'abdomen', 'pelvis', 'head'})
    idx = {r: i for i, r in enumerate(names)}
    mesh = bpy.data.meshes.new('body')
    mesh.from_pydata(basis[:n].tolist(), [], mh.faces)
    obj = bpy.data.objects.new('body', mesh)
    bpy.context.scene.collection.objects.link(obj)
    for name in names:
        mesh.materials.append(bpy.data.materials.new(name))
    mesh.polygons.foreach_set('material_index', [idx[r] for r in freg])
    obj.shape_key_add(name='Basis', from_mix=False)
    for key, co in absolute.items():
        kb = obj.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set('co', co[:n].ravel())
        kb.slider_min, kb.value = -1.0, 0.0   # Blender 5 adds keys at 1.0; glTF exports this as the default weight

    bm = bmesh.new()
    bm.from_mesh(mesh)
    lab = lambda f: names[f.material_index]
    centre = lambda f: np.array(f.calc_center_median())

    def cut(pred, co, no):
        faces = [f for f in bm.faces if pred(f)]
        geom = faces + list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(co), plane_no=Vector(no))

    # Torso bands: lower ribcage, iliac crest, and the lower back behind the spine.
    torso = {'chest', 'abdomen', 'pelvis'}
    zc, zp = joint['spine02'][2] + 0.01, joint['spine04'][2] - 0.015
    yb = joint['spine03'][1] + 0.03
    cut(lambda f: lab(f) in torso, (0, 0, zc), (0, 0, 1))
    cut(lambda f: lab(f) in torso, (0, 0, zp), (0, 0, 1))
    cut(lambda f: lab(f) in torso and zp < centre(f)[2] < zc, (0, yb, 0), (0, 1, 0))
    for f in bm.faces:
        if lab(f) in torso:
            c = centre(f)
            f.material_index = idx['chest' if c[2] > zc else 'pelvis' if c[2] <= zp or c[1] > yb else 'abdomen']
    # Shoulders: a plane square to the upper arm, just inside the shoulder joint.
    for side, s in (('L', '_l'), ('R', '_r')):
        S = joint[f'upperarm01.{side}']
        a = unit(joint[f'lowerarm01.{side}'] - S)
        P = S - 0.03 * a
        near = lambda f: lab(f) in ('arm' + s, 'chest') and np.linalg.norm(centre(f) - S) < 0.18
        armpit = S[2] - 0.07
        cut(near, P, a)
        cut(near, (0, 0, armpit), (0, 0, 1))
        for f in bm.faces:
            if near(f):
                c = centre(f)
                outside = (c - P) @ a > 0
                if outside and c[2] > armpit:
                    f.material_index = idx['arm' + s]
                elif not outside and lab(f) == 'arm' + s:
                    f.material_index = idx['chest']
    # Neck: through the neck joint, square to the neck but lower at the throat than at the nape.
    N = joint['neck01']
    nrm = unit(unit(joint_tail['neck01'] - N) + np.array([0, -0.4, 0]))
    nearn = lambda f: lab(f) in ('head', 'chest') and np.linalg.norm(centre(f) - N) < 0.16
    cut(nearn, N, nrm)
    for f in bm.faces:
        if nearn(f):
            f.material_index = idx['head' if (centre(f) - N) @ nrm > 0 else 'chest']
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.shade_smooth()
    mesh.normals_split_custom_set_from_vertices([v.vector[:] for v in mesh.vertex_normals])

    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = []
    for part in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.data.materials]:
        used = {p.material_index for p in part.data.polygons}
        if not used:
            bpy.data.objects.remove(part, do_unlink=True)
            continue
        region = part.data.materials[used.pop()].name
        part.name = part.data.name = 'region_' + region
        part.data.materials.clear()
        parts.append(part)
    return parts


def make_eyes(spheres):
    """Eyeballs fitted to MakeHuman's eye helper geometry; morphs move them with the face."""
    bm = bmesh.new()
    for centre, radius in spheres['basis']:
        geom = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=radius)
        bmesh.ops.translate(bm, verts=geom['verts'], vec=Vector(centre))
    mesh = bpy.data.meshes.new('region_eyes')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('region_eyes', mesh)
    bpy.context.scene.collection.objects.link(obj)
    for p in mesh.polygons:
        p.use_smooth = True
    count = len(mesh.vertices) // 2
    base = np.array([v.co[:] for v in mesh.vertices])
    obj.shape_key_add(name='Basis', from_mix=False)
    for key, pair in spheres.items():
        if key == 'basis':
            continue
        co = base.copy()
        for k, (centre, radius) in enumerate(pair):
            c0, r0 = spheres['basis'][k]
            sl = slice(k * count, (k + 1) * count)
            co[sl] = centre + (base[sl] - c0) * (radius / r0)
        kb = obj.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set('co', co.ravel())
        kb.slider_min, kb.value = -1.0, 0.0
    return obj


def make_cabin(floor_z):
    """Deck disc and rim under the floating crew member: the habitat/environment region."""
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=128, radius=0.60)
    rim = bmesh.ops.create_circle(bm, segments=128, radius=0.62)
    wall = bmesh.ops.extrude_edge_only(bm, edges=[e for e in bm.edges if all(v in rim['verts'] for v in e.verts)])
    bmesh.ops.translate(bm, verts=[v for v in wall['geom'] if isinstance(v, bmesh.types.BMVert)], vec=Vector((0, 0, 0.012)))
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=Vector((0, 0, floor_z)))
    mesh = bpy.data.meshes.new('region_cabin')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('region_cabin', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ------------------------------------------------------------------ body scan frames
# The app's body scan (src/scan.mjs) measures three front-view breadths from MediaPipe's person mask and pose
# landmarks. To calibrate it in MediaPipe's own terms, every basis shape is rendered here as a camera frame,
# standing as the scan asks (arms straight and a little out), from several distances, heights and arm angles.
# scripts/calibrate-scan.mjs then runs the app's pose model on these frames and writes src/body-calibration.mjs.
SCAN_FRAMES = os.environ.get('SCAN_FRAMES') or os.path.join(REPO, '.cache', 'scan-frames')
SCAN_ARMS = (22, 30, 38)                                 # arm angle from the torso line, degrees
# Camera distance and height above the body centre, metres. The 1.7 m view crops the feet: the scan must refuse it.
SCAN_VIEWS = ((2.3, 0.0), (2.6, 0.1), (2.9, -0.15), (1.7, 0.25))
SCAN_SHAPES = ('reference', 'female', 'm_heavy', 'm_light', 'm_muscular', 'm_slight', 'f_heavy', 'f_light',
               'f_muscular', 'f_slight', 'shoulders_wide', 'shoulders_narrow', 'waist_wide', 'waist_narrow',
               'hips_wide', 'hips_narrow')


def scan_pose(arms):
    a = unit([math.sin(deg(arms)), 0.0, -math.cos(deg(arms))])
    return {'upperarm01.L': a, 'lowerarm01.L': a, 'upperarm01.R': mirror(a), 'lowerarm01.R': mirror(a)}


# Bodies kept out of the calibration, to test what a scan recovers. Profile builds map to MakeHuman's muscle
# macro as the app blends them: slight 0.18, average 0.6, muscular 0.88. The fluid body is the reference with
# HIDH's 0g fluid shift, so the Legs check can be tested against the 6% leg thinning the handbook describes.
HOLDOUTS = {
    'holdout_f_heavier': ({'gender': 0.0, 'weight': 0.8}, []),
    'holdout_m_shoulders_wide_hips_narrow': ({}, [('torso/measure-shoulder-dist-incr', 0.5), ('torso/measure-hips-circ-decr', 0.5)]),
    'holdout_f_muscular_waist_narrow': ({'gender': 0.0, 'muscle': 0.88}, [('torso/measure-waist-circ-decr', 0.6)]),
    'holdout_m_slight_light': ({'muscle': 0.18, 'weight': 0.35}, []),
    'holdout_f_slight_hips_wide': ({'gender': 0.0, 'muscle': 0.18}, [('torso/measure-hips-circ-incr', 0.4)]),
    'holdout_m_muscular_heavier': ({'muscle': 0.88, 'weight': 0.65}, []),
    'holdout_f_light_shoulders_wide': ({'gender': 0.0, 'weight': 0.3}, [('torso/measure-shoulder-dist-incr', 0.4)]),
    'holdout_m_heavy_waist_wide': ({'weight': 0.9}, [('torso/measure-waist-circ-incr', 0.5)]),
}


def holdout_shapes(mh, fluid):
    shapes = {name: mh.shape(dict(REFERENCE, **macro), extra) for name, (macro, extra) in HOLDOUTS.items()}
    shapes['holdout_fluid_0g'] = fluid
    return shapes


def render_scan_frames(mh, shapes, vreg):
    """Front camera frames (640 x 480, 45 deg vertical field of view) in Workbench, plus a manifest."""
    os.makedirs(SCAN_FRAMES, exist_ok=True)
    reset_scene()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.background_type = 'WORLD'
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 640, 480, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('scan')
    scene.world.color = (0.55, 0.57, 0.6)
    cam = bpy.data.objects.new('scan-camera', bpy.data.cameras.new('scan-camera'))
    cam.data.lens, cam.data.sensor_fit, cam.data.sensor_height = 4.0, 'VERTICAL', 3.3
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def material(name, rgb):
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*rgb, 1)
        return m
    mats = [material('skin', (0.78, 0.58, 0.47)), material('top', (0.85, 0.85, 0.82)), material('shorts', (0.15, 0.2, 0.32)),
            material('eye', (0.95, 0.95, 0.93)), material('iris', (0.12, 0.08, 0.06)), material('hair', (0.12, 0.09, 0.07))]
    n = mh.body_count
    face_label = [max(set(vreg[f].tolist()), key=vreg[f].tolist().count) for f in mh.faces]
    face_mat = []
    for f, label in zip(mh.faces, face_label):
        if label in ('chest', 'abdomen'):
            face_mat.append(1)
        elif label == 'pelvis' or (label.startswith('leg') and mh.base[f, 2].mean() > -0.25):
            face_mat.append(2)
        else:
            face_mat.append(0)
    frames = []
    for name, co in shapes.items():
        sk = Skeleton(mh, co)
        for arms in SCAN_ARMS:
            for obj in [o for o in scene.objects if o is not cam]:
                bpy.data.objects.remove(obj)
            full = sk.skin(co, sk.pose(scan_pose(arms), {}, {}))
            posed = full[:n]
            me = bpy.data.meshes.new(name)
            me.from_pydata([tuple(v) for v in posed], [], mh.faces)
            for m in mats[:3]:
                me.materials.append(m)
            me.polygons.foreach_set('material_index', face_mat)
            me.shade_smooth()
            scene.collection.objects.link(bpy.data.objects.new(name, me))
            for side in ('l', 'r'):
                p = full[mh.group(f'helper-{side}-eye')]
                c = p.mean(axis=0)
                r = float(np.linalg.norm(p - c, axis=1).mean())
                for radius, at, m in ((r * 0.9, c, mats[3]), (r * 0.45, c + np.array([0, -r * 0.62, 0]), mats[4])):
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=tuple(at))
                    bpy.context.active_object.data.materials.append(m)
            top = posed[posed[:, 2] > posed[:, 2].max() - 0.11]
            hc = top.mean(axis=0)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=float(np.ptp(top[:, 0]) / 2 * 1.03), location=(hc[0], hc[1] + 0.012, hc[2] + 0.05))
            hair = bpy.context.active_object
            hair.scale = (1, 1.08, 0.75)
            hair.data.materials.append(mats[5])
            centre = (posed[:, 2].min() + posed[:, 2].max()) / 2
            for distance, height in SCAN_VIEWS:
                cam.location = (0.0, -distance, centre + height)
                file = f'{name}_a{arms}_d{distance:g}.png'
                scene.render.filepath = os.path.join(SCAN_FRAMES, file)
                bpy.ops.render.render(write_still=True)
                frames.append({'file': file, 'shape': name, 'arms': arms, 'distance': distance, 'height': height})
    with open(os.path.join(SCAN_FRAMES, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'frames': frames, 'views': SCAN_VIEWS, 'arms': SCAN_ARMS,
                   'camera': {'width': 640, 'height': 480, 'verticalFovDeg': round(math.degrees(2 * math.atan(1.65 / 4.0)), 1)}}, f, indent=1)
    reset_scene()
    return len(frames)


def main():
    reset_scene()
    mh = MakeHuman(mpfb_archive())
    aims, curls, flex = posture()

    def macro(**changes):
        m = json.loads(json.dumps(REFERENCE))
        m.update(changes)
        return m

    rest = {
        'reference': mh.shape(REFERENCE),
        'female': mh.shape(macro(gender=0.0)),
        'm_heavy': mh.shape(macro(weight=1.0)), 'm_light': mh.shape(macro(weight=0.0)),
        'm_muscular': mh.shape(macro(muscle=1.0)), 'm_slight': mh.shape(macro(muscle=0.0)),
        'f_heavy': mh.shape(macro(gender=0.0, weight=1.0)), 'f_light': mh.shape(macro(gender=0.0, weight=0.0)),
        'f_muscular': mh.shape(macro(gender=0.0, muscle=1.0)), 'f_slight': mh.shape(macro(gender=0.0, muscle=0.0)),
        'shoulders_wide': mh.shape(REFERENCE, [('torso/measure-shoulder-dist-incr', 1.0)]),
        'shoulders_narrow': mh.shape(REFERENCE, [('torso/measure-shoulder-dist-decr', 1.0)]),
        'waist_wide': mh.shape(REFERENCE, [('torso/measure-waist-circ-incr', 1.0)]),
        'waist_narrow': mh.shape(REFERENCE, [('torso/measure-waist-circ-decr', 1.0)]),
        'hips_wide': mh.shape(REFERENCE, [('torso/measure-hips-circ-incr', 1.0)]),
        'hips_narrow': mh.shape(REFERENCE, [('torso/measure-hips-circ-decr', 1.0)]),
    }
    ref_skeleton = Skeleton(mh, rest['reference'])
    vreg, totals = vertex_regions(mh)
    rest['fluid_0g'] = fluid_shift(mh, rest['reference'], vreg, ref_skeleton)
    scan_frames = 0
    if os.environ.get('SCAN_RENDER', '1') != '0':
        scan_frames = render_scan_frames(mh, {**{k: rest[k] for k in SCAN_SHAPES}, **holdout_shapes(mh, rest['fluid_0g'])}, vreg)

    soles = rest['reference'][:mh.body_count, 2].min()
    stature = {'male': float(rest['reference'][:mh.body_count, 2].max() - soles),
               'female': float(rest['female'][:mh.body_count, 2].max() - rest['female'][:mh.body_count, 2].min())}

    posed = {}
    for key, co in rest.items():
        sk = ref_skeleton if key == 'fluid_0g' else Skeleton(mh, co)
        posed[key] = sk.skin(co, sk.pose(aims, curls, flex))
    posed['spine_0g'] = ref_skeleton.skin(rest['reference'], ref_skeleton.pose(aims, curls, flex, stretch=0.03 * stature['male']))

    ref = posed['reference']
    morph = {
        'female': posed['female'] - ref,
        'heavy': posed['m_heavy'] - ref, 'light': posed['m_light'] - ref,
        'muscular': posed['m_muscular'] - ref, 'slight': posed['m_slight'] - ref,
        'female_heavy': posed['f_heavy'] - posed['female'] - (posed['m_heavy'] - ref),
        'female_light': posed['f_light'] - posed['female'] - (posed['m_light'] - ref),
        'female_muscular': posed['f_muscular'] - posed['female'] - (posed['m_muscular'] - ref),
        'female_slight': posed['f_slight'] - posed['female'] - (posed['m_slight'] - ref),
    }
    for key in ('shoulders_wide', 'shoulders_narrow', 'waist_wide', 'waist_narrow', 'hips_wide', 'hips_narrow', 'fluid_0g', 'spine_0g'):
        morph[key] = posed[key] - ref

    # Place the body: centred over the origin, the lowest posed point just above the deck.
    floor = ref[:mh.body_count, 2].min()
    centre = ref[:mh.body_count].mean(axis=0)
    offset = np.array([-centre[0], -centre[1], -floor + 0.06])
    basis = ref + offset
    absolute = {k: basis + d for k, d in morph.items()}

    freg = face_regions(mh, vreg, totals, rest['reference'], ref_skeleton)
    deform = ref_skeleton.pose(aims, curls, flex)
    joint = {b: deform[b][:3, :3] @ ref_skeleton.head[b] + deform[b][:3, 3] + offset for b in deform}
    joint_tail = {b: deform[b][:3, :3] @ ref_skeleton.tail[b] + deform[b][:3, 3] + offset for b in deform}
    objects = build_regions(mh, freg, basis, absolute, joint, joint_tail)

    def eye_spheres(co):
        out = []
        for side in ('l', 'r'):
            p = co[mh.group(f'helper-{side}-eye')]
            c = p.mean(axis=0)
            out.append((c, float(np.linalg.norm(p - c, axis=1).mean())))
        return out
    spheres = {'basis': eye_spheres(basis)}
    for k, co in absolute.items():
        spheres[k] = eye_spheres(co)
    objects.append(make_eyes(spheres))
    objects.append(make_cabin(0.0))

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True,
                              export_materials='NONE', export_normals=True, export_texcoords=False,
                              export_morph=True, export_morph_normal=False, export_try_sparse_sk=True,
                              export_apply=False)
    bbox = basis[:mh.body_count]
    meta = {
        'source': {'mesh': 'MakeHuman hm08 base mesh, macro targets and default rig weights (CC0)',
                   'archive': MPFB_URL, 'sha256': MPFB_SHA,
                   'posture': 'NASA/SP-2010-3407/REV1 Human Integration Design Handbook, Figure 4.3-2',
                   'adaptation': 'NASA/SP-2010-3407/REV1 Table 4.3-4 Anthropometric Changes in 0g'},
        'reference': {'sex': 'male', 'ageYears': 35, 'stature': round(stature['male'], 4)},
        'stature': {k: round(v, 4) for k, v in stature.items()},
        'posture': {'headForward': HEAD_FORWARD, 'shoulderFlexion': 36, 'elbow': FOREARM_ELBOW,
                    'trunkThigh': 128, 'knee': SHANK_KNEE, 'foot': FOOT_TO_TORSO},
        'morphs': list(morph),
        'zeroG': {'spineStretchOfStature': 0.03, 'legCircumference': -0.06, 'chestCircumference': 0.02, 'faceMm': 2.5},
        'scanFrames': {'count': scan_frames, 'armsFromVertical': list(SCAN_ARMS), 'views': [list(v) for v in SCAN_VIEWS],
                       'calibration': 'scripts/calibrate-scan.mjs -> src/body-calibration.mjs'},
        'bounds': {'min': [round(float(x), 4) for x in bbox.min(axis=0)], 'max': [round(float(x), 4) for x in bbox.max(axis=0)]},
    }
    with open(META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    faces = sum(len(o.data.polygons) for o in objects)
    print(f'BODY_EXPORTED {OUT} parts={len(objects)} faces={faces} size={os.path.getsize(OUT)} stature={stature}')
    return objects


main()
