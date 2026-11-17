#!/usr/bin/env python3
"""Pack rigged glTF characters + animation clips into src/charpack.js (one embedded blob).
Usage: python3 tools/pack_chars.py
Each entry: name -> glb file, which meshes to keep, which clips to take (from any glb with the same Mixamo skeleton).
"""
import base64, json, struct, pathlib, sys, io
import numpy as np
from pygltflib import GLTF2

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

def san(n): return ''.join(ch for ch in (n or '') if ch not in '[]./: ')

class G:
    def __init__(self, path):
        self.g = GLTF2().load(str(path)); self.bin = self.g.binary_blob()
    def acc(self, i):
        a = self.g.accessors[i]; bv = self.g.bufferViews[a.bufferView]
        dt = COMP[a.componentType]; n = NC[a.type]
        off = (bv.byteOffset or 0) + (a.byteOffset or 0)
        stride = bv.byteStride or 0
        isz = np.dtype(dt).itemsize * n
        if stride and stride != isz:
            raw = np.frombuffer(self.bin, np.uint8, count=stride * (a.count - 1) + isz, offset=off)
            arr = np.stack([np.frombuffer(raw[k*stride:k*stride+isz].tobytes(), dt) for k in range(a.count)])
        else:
            arr = np.frombuffer(self.bin, dt, count=a.count * n, offset=off).reshape(a.count, n)
        if a.normalized and dt != np.float32:
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr
    def image(self, i):
        im = self.g.images[i]; bv = self.g.bufferViews[im.bufferView]
        return self.bin[(bv.byteOffset or 0):(bv.byteOffset or 0) + bv.byteLength], im.mimeType

class Blob:
    def __init__(self): self.buf = io.BytesIO()
    def add(self, arr):
        arr = np.ascontiguousarray(arr)
        while self.buf.tell() % 4: self.buf.write(b'\0')
        off = self.buf.tell(); self.buf.write(arr.tobytes())
        return {"o": off, "n": int(arr.size), "t": {np.dtype(np.float32): 'f32', np.dtype(np.uint16): 'u16', np.dtype(np.uint32): 'u32', np.dtype(np.uint8): 'u8'}[arr.dtype]}

def decompose(m):
    M = np.array(m, dtype=np.float64).reshape(4, 4).T
    t = M[:3, 3].tolist(); R = M[:3, :3].copy(); sc = np.linalg.norm(R, axis=0)
    if np.linalg.det(R) < 0: sc[0] = -sc[0]
    R = R / sc
    tr = R[0, 0] + R[1, 1] + R[2, 2]
    if tr > 0:
        S = np.sqrt(tr + 1.0) * 2; w = 0.25 * S; x = (R[2, 1] - R[1, 2]) / S; y = (R[0, 2] - R[2, 0]) / S; z = (R[1, 0] - R[0, 1]) / S
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        S = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2; w = (R[2, 1] - R[1, 2]) / S; x = 0.25 * S; y = (R[0, 1] + R[1, 0]) / S; z = (R[0, 2] + R[2, 0]) / S
    elif R[1, 1] > R[2, 2]:
        S = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2; w = (R[0, 2] - R[2, 0]) / S; x = (R[0, 1] + R[1, 0]) / S; y = 0.25 * S; z = (R[1, 2] + R[2, 1]) / S
    else:
        S = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2; w = (R[1, 0] - R[0, 1]) / S; x = (R[0, 2] + R[2, 0]) / S; y = (R[1, 2] + R[2, 1]) / S; z = 0.25 * S
    return t, [float(x), float(y), float(z), float(w)], sc.tolist()

def pack_model(blob, gl, keep_meshes=None, max_tex=1024):
    g = gl.g
    nodes = []
    for i, n in enumerate(g.nodes):
        t, r, sc = n.translation or [0, 0, 0], n.rotation or [0, 0, 0, 1], n.scale or [1, 1, 1]
        if n.matrix and any(abs(a - b) > 1e-9 for a, b in zip(n.matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])): t, r, sc = decompose(n.matrix)
        nodes.append({"name": san(n.name) or f"node{i}", "c": n.children or [], "t": t, "r": r, "s": sc,
                      "mesh": n.mesh, "skin": n.skin})
    roots = g.scenes[g.scene or 0].nodes
    skins = []
    for s in g.skins:
        skins.append({"joints": s.joints, "ibm": blob.add(gl.acc(s.inverseBindMatrices).astype(np.float32))})
    # textures
    texs = {}
    from PIL import Image
    def tex(idx):
        if idx is None: return None
        src = g.textures[idx].source
        if src in texs: return texs[src]
        data, mime = gl.image(src)
        im = Image.open(io.BytesIO(data)); im.load()
        if max(im.size) > max_tex: im.thumbnail((max_tex, max_tex))
        out = io.BytesIO()
        if im.mode in ('RGBA', 'LA') and np.asarray(im.convert('RGBA'))[..., 3].min() < 250: im.save(out, 'PNG', optimize=True); m = 'image/png'
        else: im.convert('RGB').save(out, 'JPEG', quality=82); m = 'image/jpeg'
        texs[src] = len(texs); TEXLIST.append("data:%s;base64,%s" % (m, base64.b64encode(out.getvalue()).decode()))
        return texs[src]
    TEXLIST = []
    mats = []
    for m in g.materials:
        pb = m.pbrMetallicRoughness
        mats.append({"name": m.name, "color": (pb.baseColorFactor if pb and pb.baseColorFactor else [1, 1, 1, 1]),
                     "map": tex(pb.baseColorTexture.index) if pb and pb.baseColorTexture else None,
                     "mr": tex(pb.metallicRoughnessTexture.index) if pb and pb.metallicRoughnessTexture else None,
                     "metal": pb.metallicFactor if pb and pb.metallicFactor is not None else 1, "rough": pb.roughnessFactor if pb and pb.roughnessFactor is not None else 1,
                     "nrm": tex(m.normalTexture.index) if m.normalTexture else None, "em": tex(m.emissiveTexture.index) if m.emissiveTexture else None,
                     "emc": m.emissiveFactor or [0, 0, 0], "alpha": m.alphaMode})
    meshes = []
    for mi, me in enumerate(g.meshes):
        if keep_meshes is not None and me.name not in keep_meshes: meshes.append(None); continue
        prims = []
        for p in me.primitives:
            A = p.attributes
            pos = gl.acc(A.POSITION).astype(np.float32); nrm = gl.acc(A.NORMAL).astype(np.float32)
            uv = gl.acc(A.TEXCOORD_0).astype(np.float32) if A.TEXCOORD_0 is not None else np.zeros((len(pos), 2), np.float32)
            j = gl.acc(A.JOINTS_0).astype(np.uint16); w = gl.acc(A.WEIGHTS_0).astype(np.float32)
            w = w / np.maximum(w.sum(1, keepdims=True), 1e-6)
            if p.indices is not None: idx = gl.acc(p.indices).reshape(-1)
            else: idx = np.arange(len(pos))
            # weld identical vertices (FBX→glTF output is unindexed)
            key = np.concatenate([np.round(pos, 5).view(np.uint8).reshape(len(pos), -1), np.round(nrm, 3).view(np.uint8).reshape(len(pos), -1), np.round(uv, 5).view(np.uint8).reshape(len(pos), -1), j.view(np.uint8).reshape(len(pos), -1)], 1)
            _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
            pos, nrm, uv, j, w = pos[first], nrm[first], uv[first], j[first], w[first]; idx = inv.reshape(-1)[idx]
            idx = idx.astype(np.uint16 if len(pos) < 65535 else np.uint32)
            prims.append({"pos": blob.add(pos), "nrm": blob.add(nrm), "uv": blob.add(uv), "j": blob.add(j), "w": blob.add((w * 255 + 0.5).clip(0, 255).astype(np.uint8)), "idx": blob.add(idx), "mat": p.material})
        meshes.append({"name": me.name, "prims": prims})
    return {"nodes": nodes, "roots": roots, "skins": skins, "mats": mats, "meshes": meshes, "tex": TEXLIST}

def pack_clips(blob, gl, names, rename=None, skip_root_xz=True):
    g = gl.g; out = []
    for an in g.animations:
        if an.name not in names: continue
        tracks = []
        for ch in an.channels:
            smp = an.samplers[ch.sampler]; node = san(g.nodes[ch.target.node].name); path = ch.target.path
            if path not in ('rotation', 'translation'): continue
            if path == 'translation' and not node.endswith('Hips'): continue
            times = gl.acc(smp.input).reshape(-1).astype(np.float32); vals = gl.acc(smp.output).astype(np.float32)
            if path == 'translation' and skip_root_xz:
                vals = vals.copy(); vals[:, 0] = vals[0, 0]; vals[:, 2] = vals[0, 2]   # in-place locomotion
            # thin keys to ~30fps
            if len(times) > 2:
                keep = [0]; last = times[0]
                for k in range(1, len(times) - 1):
                    if times[k] - last >= 1 / 30 - 1e-4: keep.append(k); last = times[k]
                keep.append(len(times) - 1); times = times[keep]; vals = vals[keep]
            tracks.append({"n": node, "p": 'q' if path == 'rotation' else 'p', "t": blob.add(times), "v": blob.add(vals.astype(np.float32))})
        out.append({"name": (rename or {}).get(an.name, an.name), "tracks": tracks})
    return out

def pack_json_clips(blob, files, src_hips_y):
    out = []
    for f in files:
        d = json.loads(pathlib.Path(f).read_text()); tracks = []
        for t in d["tracks"]:
            node, prop = t["name"].rsplit(".", 1)
            node = san(node)
            if prop not in ("quaternion", "position"): continue
            if prop == "position" and not node.endswith("Hips"): continue
            times = np.array(t["times"], np.float32); vals = np.array(t["values"], np.float32).reshape(len(times), -1)
            if prop == "position": vals = vals.copy(); vals[:, 0] = vals[0, 0]; vals[:, 2] = vals[0, 2]
            tracks.append({"n": node, "p": "q" if prop == "quaternion" else "p", "t": blob.add(times), "v": blob.add(vals.astype(np.float32))})
        out.append({"name": d["key"], "tracks": tracks})
    return out

def write_pack(path, var, obj, blob):
    data = blob.buf.getvalue()
    path.write_text("/* generated by tools/pack_chars.py */\nCharLib.add(" + json.dumps(var) + "," + json.dumps(obj, separators=(",", ":")) + ",'" + base64.b64encode(data).decode() + "');\n")
    return len(data)

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "mixamo":
    # python3 tools/pack_chars.py mixamo <converted dir> <out assets dir>
    src = pathlib.Path(sys.argv[2]); out = pathlib.Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
    spec = json.loads((ROOT / "tools" / "mixamo.json").read_text())
    for key, m in spec["chars"].items():
        f = src / (key + ".glb")
        if not f.exists(): print("missing", key); continue
        blob = Blob(); pk = pack_model(blob, G(f), None, m.get("tex", 512))
        n = write_pack(out / ("char_" + key + ".js"), "char:" + key, pk, blob); print("char", key, round(n / 1e6, 2), "MB")
    blob = Blob(); clips = pack_json_clips(blob, sorted(str(p) for p in src.glob("*.json")), None)
    n = write_pack(out / "anims.js", "anims", {"clips": clips}, blob); print("anims", len(clips), round(n / 1e6, 2), "MB")
    sys.exit(0)

SPEC = json.loads((ROOT / "tools" / "charpack.json").read_text())
blob = Blob(); pack = {"models": {}, "clips": []}
for name, m in SPEC["models"].items():
    pack["models"][name] = pack_model(blob, G(ASSETS / m["file"]), m.get("meshes"), m.get("maxTex", 1024))
for c in SPEC["clips"]:
    pack["clips"] += pack_clips(blob, G(ASSETS / c["file"]), c["names"], c.get("rename"))
data = blob.buf.getvalue()
js = "/* generated by tools/pack_chars.py */\nconst CHARPACK = " + json.dumps(pack, separators=(',', ':')) + ";\nconst CHARBIN = '" + base64.b64encode(data).decode() + "';\n"
(ROOT / "src" / "charpack.js").write_text(js)
print("charpack.js", round(len(js) / 1e6, 2), "MB; bin", round(len(data) / 1e6, 2), "MB; clips", [c["name"] for c in pack["clips"]])
