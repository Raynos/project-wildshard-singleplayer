#!/usr/bin/env python3
"""RM5 (night-market-remaster): the open plots' ruled materials, written as graph JSON (Nine's ruled-kit method: patterns
drawn analytically from metres, no texture). python3 scripts/open-plots/ruled-graphs.py
  src/shards/open-plots/data/paving.graph.json  the paving: flagstones, joints, per-stone shade, wear (world metres)
  src/shards/open-plots/data/landmark.graph.json the landmark: its texture, gold trim glowing, its foot uplit
  src/shards/open-plots/data/kit.graph.json     the kit: plain / roof tile / timber / plaster / awning stripe / stone / banner by
                                                the face's trim band (data/trim.json)"""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'shards', 'open-plots', 'data')
TRIM = json.load(open(os.path.join(ROOT, 'trim.json')))

def graph():
    nodes = {}
    def n(node_id, op, *ins, **kw):
        node = {"op": op}
        if ins: node["in"] = list(ins)
        node.update(kw); nodes[node_id] = node; return node_id
    return nodes, n

def write(name, g):
    open(os.path.join(ROOT, name), 'w').write(json.dumps(g, indent=1) + '\n'); print(name, len(g['nodes']), 'nodes')

def flagstones(n, p, flag, row, joint, spread, wear=None):
    """flagstones in a running bond in world metres: rows across z, every other row shifted half a flag along x. Returns the
    flag's shade (a hash of its cell, worn in broad patches) and its joint (1 on a joint, antialiased; it fades as it
    shrinks under a pixel, so no moire from the air)"""
    n(p+"wp", "positionWorld"); n(p+"x", "swizzle", p+"wp", mask="x"); n(p+"z", "swizzle", p+"wp", mask="z")
    n(p+"zr", "div", p+"z", row); n(p+"ri", "floor", p+"zr"); n(p+"v", "fract", p+"zr")
    n(p+"odd", "mod", p+"ri", 2); n(p+"shift", "mul", p+"odd", 0.5)
    n(p+"xr0", "div", p+"x", flag); n(p+"xr", "add", p+"xr0", p+"shift"); n(p+"ci", "floor", p+"xr"); n(p+"u", "fract", p+"xr")
    n(p+"u1", "oneMinus", p+"u"); n(p+"um", "min", p+"u", p+"u1"); n(p+"du", "mul", p+"um", flag)
    n(p+"v1", "oneMinus", p+"v"); n(p+"vm", "min", p+"v", p+"v1"); n(p+"dv", "mul", p+"vm", row)
    n(p+"d", "min", p+"du", p+"dv")
    n(p+"aa0", "fwidth", p+"d"); n(p+"aa", "max", p+"aa0", 0.0001)
    n(p+"lo", "sub", joint, p+"aa"); n(p+"hi", "add", joint, p+"aa"); n(p+"edge", "smoothstep", p+"lo", p+"hi", p+"d"); n(p+"line0", "oneMinus", p+"edge")
    n(p+"keep0", "div", joint, p+"aa"); n(p+"keep", "saturate", p+"keep0"); n(p+"line", "mul", p+"line0", p+"keep")
    n(p+"hc", "mul", p+"ci", 12.9898); n(p+"hr", "mul", p+"ri", 78.233); n(p+"hs", "add", p+"hc", p+"hr"); n(p+"hsin", "sin", p+"hs"); n(p+"hm", "mul", p+"hsin", 43758.5453); n(p+"h", "fract", p+"hm")
    n(p+"half", "mul", spread, 0.5); n(p+"base", "sub", 1, p+"half"); n(p+"hv", "mul", p+"h", spread); n(p+"tint", "add", p+"base", p+"hv")
    if wear is None: return p+"tint", p+"line"
    n(p+"wxz", "swizzle", p+"wp", mask="xz"); n(p+"np", "mul", p+"wxz", 0.27); n(p+"nz0", "noise", p+"np"); n(p+"nz", "saturate", p+"nz0"); n(p+"worn", "mul", p+"nz", wear)
    return n(p+"shade", "sub", p+"tint", p+"worn"), p+"line"

FLAG = TRIM['flagstone']

def paving():
    """the ring floor (the terrain node): the flagstones as params over its vertex colour"""
    N, n = graph()
    P = {
      "flag": {"type": "float", "value": FLAG['flag'], "min": 0.5, "max": 20},
      "row": {"type": "float", "value": FLAG['row'], "min": 0.5, "max": 20},
      "joint": {"type": "float", "value": FLAG['joint'], "min": 0, "max": 1},
      "jointShade": {"type": "float", "value": FLAG['jointShade'], "min": 0, "max": 1},
      "spread": {"type": "float", "value": FLAG['spread'], "min": 0, "max": 1},
      "wear": {"type": "float", "value": FLAG['wear'], "min": 0, "max": 1},
      "roughness": {"type": "float", "value": 0.86, "min": 0, "max": 1},
    }
    for k in P: n(k, "param", param=k)
    shade, line = flagstones(n, "", "flag", "row", "joint", "spread", "wear")
    n("vc", "vertexColour"); n("stone", "mul", "vc", shade); n("dark", "mul", "vc", "jointShade")
    n("colour", "mix", "stone", "dark", line)
    n("rj", "add", "roughness", 0.08); n("rough", "mix", "roughness", "rj", line)
    return {"version": 1, "kind": "material", "model": "standard", "doubleSided": False, "params": P, "nodes": N,
            "stages": {"surface": {"colour": "colour", "roughness": "rough", "metalness": 0}}}

def kit():
    N, n = graph()
    BAND = TRIM['band']
    n("uv", "uv"); n("ur", "swizzle", "uv", mask="x"); n("v", "swizzle", "uv", mask="y")
    n("bf", "div", "ur", BAND); n("band", "floor", "bf"); n("bo", "mul", "band", BAND); n("u", "sub", "ur", "bo")
    def line(p, d, w):
        """1 on a joint of half-width w (m) at distance d, antialiased (the kit's small patterns are seen near: no fade, which
        keeps the graph inside the 160-node author budget)"""
        n(p+"aa0", "fwidth", d); n(p+"aa", "max", p+"aa0", 0.0001)
        n(p+"lo", "sub", w, p+"aa"); n(p+"hi", "add", w, p+"aa"); n(p+"e", "smoothstep", p+"lo", p+"hi", d); return n(p+"l", "oneMinus", p+"e")
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
    n("tv", "div", "v", 0.2); n("tfv", "fract", "tv"); td = edge("tg", "tfv", 0.2); tl = line("tl", td, 0.01)
    n("tgx", "mul", "u", 0.7); n("tgy", "mul", "v", 14); n("tgp", "combine", "tgx", "tgy"); n("tn0", "noise", "tgp"); n("tn", "saturate", "tn0")
    n("tns", "mul", "tn", 0.2); n("tb", "add", "tns", 0.8)
    n("tdark", "mix", 1, 0.5, tl); n("timber", "mul", "tb", "tdark")
    # 3 plaster draws plain (its band is kept for the models; a mottle did not read and cost the budget)
    # 5 stone: 0.45 m courses of 0.8 m blocks in a running bond, dark joints, each block its own shade
    n("sv", "div", "v", 0.45); n("sri", "floor", "sv"); n("sfv", "fract", "sv"); n("sodd", "mod", "sri", 2); n("soff", "mul", "sodd", 0.5)
    n("su0", "div", "u", 0.8); n("su", "add", "su0", "soff"); n("sci", "floor", "su"); n("sfu", "fract", "su")
    sdu = edge("sdu", "sfu", 0.8); sdv = edge("sdv", "sfv", 0.45); n("sd", "min", sdu, sdv); sl = line("sl", "sd", 0.02)
    sh = hash2("sh", "sci", "sri"); n("shs", "mul", sh, 0.14); n("sb", "add", "shs", 0.86); n("sdark", "mix", 1, 0.55, sl); n("stone", "mul", "sb", "sdark")
    # the shade for the face's band (0 plain, 4 the awning's stripes below)
    B = {k: v["band"] for k, v in TRIM["trims"].items() if "band" in v}
    n("b1", "eq", "band", B["roofTile"]); n("b2", "eq", "band", B["timber"]); n("b4", "eq", "band", B["awningStripe"]); n("b5", "eq", "band", B["stone"])
    n("s5", "select", "b5", "stone", 1); n("s2", "select", "b2", "timber", "s5"); n("shade", "select", "b1", "roof", "s2")
    n("vc", "vertexColour"); n("lit", "mul", "vc", "shade")
    # 4 awning: 0.32 m stripes along u, alternately the face colour and a warm cream
    n("au", "div", "u", 0.32); n("afu", "fract", "au"); n("ad0", "sub", "afu", 0.5); n("ad1", "abs", "ad0"); n("ad", "mul", "ad1", 0.32)
    al = line("al", "ad", 0.08); n("cream", "param", param="cream"); n("stripe", "mul", al, 0.8); n("awning", "mix", "vc", "cream", "stripe")
    # the paving: every up-facing kit face at ground level (below `FLAG['under']` m: the lanes, plaza, forecourt and court
    # floors; the lawns stand higher), ruled in world metres. No UV: a tile's bytes are raw, and its byte caps hold
    fshade, fline = flagstones(n, "f", FLAG['flag'], FLAG['row'], FLAG['joint'], FLAG['spread'])
    n("fstone", "mul", "vc", fshade); n("fdark", "mul", "vc", FLAG['jointShade']); n("flagstone", "mix", "fstone", "fdark", fline)
    n("fnw", "normalWorld"); n("fny", "swizzle", "fnw", mask="y"); n("fup", "gt", "fny", 0.99)
    n("fwy", "swizzle", "fwp", mask="y"); n("flow", "lt", "fwy", FLAG['under']); n("fis", "and", "fup", "flow")
    n("c6", "select", "fis", "flagstone", "lit")
    n("colour", "select", "b4", "awning", "c6")
    n("rough", "param", param="roughness")
    # 6 banner (RM10.4): the cloth draws plain and sways in the evening breeze, every banner together (one gust), every
    # vertex of it the same small offset across both world axes; the other bands stay put. The vertex stage reads the raw u
    # (band 6 is the only band at or past 6 x 32 m), so no band arithmetic runs twice and the kit stays at 160 nodes
    SWAY = TRIM["trims"]["banner"]["sway"]
    n("t", "time"); n("ws", "sin", "t"); n("b6", "gt", "ur", B["banner"] * BAND - 0.5)
    n("wsel", "select", "b6", "ws", 0); n("offset", "mul", "wsel", [SWAY, 0, SWAY])
    P = {"cream": {"type": "colour", "value": [0.93, 0.86, 0.72]}, "roughness": {"type": "float", "value": 0.9, "min": 0, "max": 1}}
    g = {"version": 1, "kind": "material", "model": "standard", "doubleSided": False, "params": P, "nodes": N,
         "stages": {"vertex.offset": {"offset": "offset"}, "surface": {"colour": "colour", "roughness": "rough", "metalness": 0}}}
    return g

def landmark():
    """RM6.4: the landmark (the gate) in its own texture, shaded by the sun and a warm dusk fill, its gold trim glowing and its
    foot warmed by its light pools. Unlit, so the static world transport binds its colour map (meshMap colourOrVertex)."""
    N, n = graph()
    P = {"trim": {"type": "float", "value": 1.6, "min": 0, "max": 16},
         "ambient": {"type": "colour", "value": [0.5, 0.36, 0.34]},
         # D111: the key's lavender sky fill (its ambient sky x intensity 1.4) on the faces that look up, the warm fill
         # above on those that look down, so the navy roof reads blue from the plaza and the aerials
         "skyFill": {"type": "colour", "value": [0.92, 0.87, 1.2]},
         "sunGain": {"type": "float", "value": 0.8, "min": 0, "max": 8},
         # the plot's fixed dusk sun (look.day azimuth 71, low; its key's sun colour x intensity 1.5)
         "sunDirection": {"type": "vec3", "value": [-0.913, 0.259, 0.314]},
         "sunColour": {"type": "colour", "value": [1.5, 1.23, 1.02]},
         "uplight": {"type": "colour", "value": [0.55, 0.22, 0.08]},
         "uplightHeight": {"type": "float", "value": 9, "min": 0.1, "max": 100}}
    for k in P: n(k, "param", param=k)
    n("map", "meshMap", name="colourOrVertex"); n("rgb", "swizzle", "map", mask="xyz")
    # the sun on the face and the dusk fill (the plot's fixed dusk: its key's ambient), sky above and warm below
    n("nw", "normalWorld");  n("ndl0", "dot", "nw", "sunDirection"); n("ndl", "saturate", "ndl0")
    n("ny", "swizzle", "nw", mask="y"); n("hy0", "mul", "ny", 0.5); n("hy", "add", "hy0", 0.5); n("fill", "mix", "ambient", "skyFill", "hy")
    n("sun0", "mul", "sunColour", "ndl"); n("sun", "mul", "sun0", "sunGain"); n("light", "add", "fill", "sun")
    n("lit", "mul", "rgb", "light")
    # gold: red and green high, blue low (the red pillars have no green, the navy roof is blue)
    n("r", "swizzle", "rgb", mask="x"); n("g", "swizzle", "rgb", mask="y"); n("b", "swizzle", "rgb", mask="z")
    n("rg", "min", "r", "g"); n("gold0", "sub", "rg", "b"); n("gold1", "sub", "gold0", 0.12); n("gold2", "mul", "gold1", 5); n("gold", "saturate", "gold2")
    n("gt", "mul", "rgb", "gold"); n("glow", "mul", "gt", "trim")
    # the pools' light on the gate's foot, fading up its pillars
    n("wp", "positionWorld"); n("wy", "swizzle", "wp", mask="y"); n("up0", "smoothstep", 0, "uplightHeight", "wy"); n("up1", "oneMinus", "up0")
    n("upc", "mul", "uplight", "up1"); n("upl", "mul", "upc", "rgb")
    n("e", "add", "glow", "upl"); n("colour", "add", "lit", "e")
    return {"version": 1, "kind": "material", "model": "unlit", "doubleSided": False, "params": P, "nodes": N,
            "stages": {"surface": {"colour": "colour"}}}

write('paving.graph.json', paving())
write('kit.graph.json', kit())
write('landmark.graph.json', landmark())
