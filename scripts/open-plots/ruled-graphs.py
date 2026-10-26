#!/usr/bin/env python3
"""RM5 (night-market-remaster): the open plots' ruled materials, written as graph JSON (Nine's ruled-kit method: patterns
drawn analytically from metres, no texture). python3 scripts/open-plots/ruled-graphs.py
  src/shards/open-plots/data/paving.graph.json  the paving: flagstones, joints, per-stone shade, wear (world metres)
  src/shards/open-plots/data/kit.graph.json     the kit: plain / roof tile / timber / plaster / awning stripe / stone by
                                                the face's trim band (data/trim.json)"""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'shards', 'open-plots', 'data')
TRIM = json.load(open(os.path.join(ROOT, 'trim.json')))

def graph():
    nodes = {}
    def n(name, op, *ins, **kw):
        node = {"op": op}
        if ins: node["in"] = list(ins)
        node.update(kw); nodes[name] = node; return name
    return nodes, n

def write(name, g):
    open(os.path.join(ROOT, name), 'w').write(json.dumps(g, indent=1) + '\n'); print(name, len(g['nodes']), 'nodes')

def paving():
    N, n = graph()
    P = {
      "flag": {"type": "float", "value": 3.2, "min": 0.5, "max": 20},
      "row": {"type": "float", "value": 2.4, "min": 0.5, "max": 20},
      "joint": {"type": "float", "value": 0.045, "min": 0, "max": 1},
      "jointShade": {"type": "float", "value": 0.42, "min": 0, "max": 1},
      "spread": {"type": "float", "value": 0.14, "min": 0, "max": 1},
      "wear": {"type": "float", "value": 0.1, "min": 0, "max": 1},
      "roughness": {"type": "float", "value": 0.86, "min": 0, "max": 1},
    }
    for k in P: n(k, "param", param=k)
    n("wp", "positionWorld"); n("x", "swizzle", "wp", mask="x"); n("z", "swizzle", "wp", mask="z"); n("wxz", "swizzle", "wp", mask="xz")
    # rows across z, every other row shifted half a flag along x
    n("zr", "div", "z", "row"); n("ri", "floor", "zr"); n("v", "fract", "zr")
    n("odd", "mod", "ri", 2); n("shift", "mul", "odd", 0.5)
    n("xr0", "div", "x", "flag"); n("xr", "add", "xr0", "shift"); n("ci", "floor", "xr"); n("u", "fract", "xr")
    # distance (m) to the flag's nearest edge
    n("u1", "oneMinus", "u"); n("um", "min", "u", "u1"); n("du", "mul", "um", "flag")
    n("v1", "oneMinus", "v"); n("vm", "min", "v", "v1"); n("dv", "mul", "vm", "row")
    n("d", "min", "du", "dv")
    # the joint, antialiased; it fades as it shrinks under a pixel (no moire from the air)
    n("aa0", "fwidth", "d"); n("aa", "max", "aa0", 0.0001)
    n("lo", "sub", "joint", "aa"); n("hi", "add", "joint", "aa"); n("edge", "smoothstep", "lo", "hi", "d"); n("line0", "oneMinus", "edge")
    n("keep0", "div", "joint", "aa"); n("keep", "saturate", "keep0"); n("line", "mul", "line0", "keep")
    # each flag its own shade (a hash of its cell), worn in broad patches
    n("hc", "mul", "ci", 12.9898); n("hr", "mul", "ri", 78.233); n("hs", "add", "hc", "hr"); n("hsin", "sin", "hs"); n("hm", "mul", "hsin", 43758.5453); n("h", "fract", "hm")
    n("half", "mul", "spread", 0.5); n("base", "sub", 1, "half"); n("hv", "mul", "h", "spread"); n("tint", "add", "base", "hv")
    n("np", "mul", "wxz", 0.27); n("nz0", "noise", "np"); n("nz", "saturate", "nz0"); n("worn", "mul", "nz", "wear"); n("shade", "sub", "tint", "worn")
    n("vc", "vertexColour"); n("stone", "mul", "vc", "shade"); n("dark", "mul", "vc", "jointShade")
    n("colour", "mix", "stone", "dark", "line")
    n("rj", "add", "roughness", 0.08); n("rough", "mix", "roughness", "rj", "line")
    g = {"version": 1, "kind": "material", "model": "standard", "doubleSided": False, "params": P, "nodes": N,
         "stages": {"surface": {"colour": "colour", "roughness": "rough", "metalness": 0}}}
    return g

def kit():
    N, n = graph()
    BAND = TRIM['band']
    n("uv", "uv"); n("ur", "swizzle", "uv", mask="x"); n("v", "swizzle", "uv", mask="y")
    n("bf", "div", "ur", BAND); n("band", "floor", "bf"); n("bo", "mul", "band", BAND); n("u", "sub", "ur", "bo")
    n("uvm", "combine", "u", "v")
    def line(p, d, w):
        """1 on a joint of half-width w (m) at distance d, antialiased; fades as it shrinks under a pixel"""
        n(p+"aa0", "fwidth", d); n(p+"aa", "max", p+"aa0", 0.0001)
        n(p+"lo", "sub", w, p+"aa"); n(p+"hi", "add", w, p+"aa"); n(p+"e", "smoothstep", p+"lo", p+"hi", d); n(p+"l0", "oneMinus", p+"e")
        n(p+"k0", "div", w, p+"aa"); n(p+"k", "saturate", p+"k0"); return n(p+"l", "mul", p+"l0", p+"k")
    def edge(p, f, size):
        """distance (m) to the nearest cell border of a fract coordinate f over a cell `size` m"""
        n(p+"f1", "oneMinus", f); n(p+"fm", "min", f, p+"f1"); return n(p+"d", "mul", p+"fm", size)
    def hash2(p, a, b):
        n(p+"ha", "mul", a, 12.9898); n(p+"hb", "mul", b, 78.233); n(p+"hs", "add", p+"ha", p+"hb"); n(p+"hn", "sin", p+"hs"); n(p+"hm", "mul", p+"hn", 43758.5453)
        return n(p+"h", "fract", p+"hm")
    # 1 roof tile: rows of 0.3 m down the slope, 0.24 m rounded tiles staggered per row, a dark lip under each row
    n("rv", "div", "v", 0.3); n("rri", "floor", "rv"); n("rfv", "fract", "rv")
    n("rodd", "mod", "rri", 2); n("roff", "mul", "rodd", 0.5); n("ru0", "div", "u", 0.24); n("ru", "add", "ru0", "roff"); n("rfu", "fract", "ru")
    n("rpi", "mul", "rfu", 3.14159265); n("rb", "sin", "rpi"); n("rbs", "mul", "rb", 0.34); n("rsh", "add", "rbs", 0.7)
    n("rlipd", "mul", "rfv", 0.3); rl = line("rl", "rlipd", 0.03); n("rdark", "mix", 1, 0.55, rl); n("roof", "mul", "rsh", "rdark")
    # 2 timber: 0.2 m planks across v, a grain along u, each plank its own shade, dark gaps
    n("tv", "div", "v", 0.2); n("tpi", "floor", "tv"); n("tfv", "fract", "tv"); td = edge("tg", "tfv", 0.2); tl = line("tl", td, 0.01)
    n("tgx", "mul", "u", 0.7); n("tgy", "mul", "v", 14); n("tgp", "combine", "tgx", "tgy"); n("tn0", "noise", "tgp"); n("tn", "saturate", "tn0")
    th = hash2("th", "tpi", 3.7); n("tns", "mul", "tn", 0.16); n("ths", "mul", th, 0.1); n("tb0", "add", "tns", "ths"); n("tb", "add", "tb0", 0.78)
    n("tdark", "mix", 1, 0.5, tl); n("timber", "mul", "tb", "tdark")
    # 3 plaster: a soft mottle
    n("pp", "mul", "uvm", 0.9); n("pn0", "noise", "pp"); n("pn", "saturate", "pn0"); n("pns", "mul", "pn", 0.08); n("plaster", "add", "pns", 0.93)
    # 5 stone: 0.45 m courses of 0.8 m blocks in a running bond, dark joints, each block its own shade
    n("sv", "div", "v", 0.45); n("sri", "floor", "sv"); n("sfv", "fract", "sv"); n("sodd", "mod", "sri", 2); n("soff", "mul", "sodd", 0.5)
    n("su0", "div", "u", 0.8); n("su", "add", "su0", "soff"); n("sci", "floor", "su"); n("sfu", "fract", "su")
    sdu = edge("sdu", "sfu", 0.8); sdv = edge("sdv", "sfv", 0.45); n("sd", "min", sdu, sdv); sl = line("sl", "sd", 0.02)
    sh = hash2("sh", "sci", "sri"); n("shs", "mul", sh, 0.14); n("sb", "add", "shs", 0.86); n("sdark", "mix", 1, 0.55, sl); n("stone", "mul", "sb", "sdark")
    # the shade for the face's band (0 plain, 4 the awning's stripes below)
    B = {k: v["band"] for k, v in TRIM["trims"].items()}
    n("b1", "eq", "band", B["roofTile"]); n("b2", "eq", "band", B["timber"]); n("b3", "eq", "band", B["plaster"]); n("b4", "eq", "band", B["awningStripe"]); n("b5", "eq", "band", B["stone"])
    n("s5", "select", "b5", "stone", 1); n("s3", "select", "b3", "plaster", "s5"); n("s2", "select", "b2", "timber", "s3"); n("shade", "select", "b1", "roof", "s2")
    n("vc", "vertexColour"); n("lit", "mul", "vc", "shade")
    # 4 awning: 0.32 m stripes along u, alternately the face colour and a warm cream
    n("au", "div", "u", 0.32); n("afu", "fract", "au"); n("ad0", "sub", "afu", 0.5); n("ad1", "abs", "ad0"); n("ad", "mul", "ad1", 0.32)
    al = line("al", "ad", 0.08); n("cream", "param", param="cream"); n("stripe", "mul", al, 0.8); n("awning", "mix", "vc", "cream", "stripe")
    n("colour", "select", "b4", "awning", "lit")
    n("rough", "param", param="roughness")
    P = {"cream": {"type": "colour", "value": [0.93, 0.86, 0.72]}, "roughness": {"type": "float", "value": 0.9, "min": 0, "max": 1}}
    g = {"version": 1, "kind": "material", "model": "standard", "doubleSided": False, "params": P, "nodes": N,
         "stages": {"surface": {"colour": "colour", "roughness": "rough", "metalness": 0}}}
    return g

write('paving.graph.json', paving())
write('kit.graph.json', kit())
