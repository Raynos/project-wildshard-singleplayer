# Pine held playback rows

`heldPlayback.json` is the authored ClientChannelProgram source for the
crossbow and lever firearm. Edit these rows directly; there is no producer.
Each weapon has six independent programs bound to the private `root` model:
x/y/z position and XYZ pitch/yaw/roll. Numeric references point to earlier
nodes in the same program, never to another program.

The native weapon still owns action clocks, recoil and look springs, reload,
ADS sight solving, scale, hands and contact outcomes. Reads copy those scalar
observations into playback. `time` is world time; `clock.delta` is frame delta.
The rows combine hip, portrait-weighted sprint, loading, breath/bob/look lag,
recoil and native ADS targets. Crossbow inspection precedes holster; lever
inspection overrides holster. Lever cycle reads use the authored cycle offsets.

Each axis retains local 0 (previous visual value) and local 1 (initialized).
The first frame takes the target directly; later frames follow at dt*14
(crossbow) or dt*16 (lever), capped at 1. Lever inspection takes its target
directly. At most 88 nodes, 17 reads and 2 private slots per program are used;
the shared 128-node / 32-read admission caps remain unchanged.

The following tables name semantic checkpoints and spell out every operation.
`nN` means node N; reads and locals reference their declared arrays. To change
a coefficient, edit its constant node; to change order, edit the references
and the channel/local outputs together.

## crossbow.pose.x

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied reloadTilt | `read reloadTilt` |
| 14 |  | `mul(a=n2, b=n9)` |
| 15 |  | `sin(a=n14)` |
| 16 | constant 0.0025 | `0.0025` |
| 17 |  | `mul(a=n15, b=n16)` |
| 18 |  | `cos(a=n3)` |
| 19 | constant 0.016 | `0.016` |
| 20 |  | `mul(a=n18, b=n19)` |
| 21 |  | `mul(a=n20, b=n4)` |
| 22 |  | `add(a=n17, b=n21)` |
| 23 | copied lagYaw | `read lagYaw` |
| 24 | constant 0.25 | `0.25` |
| 25 |  | `mul(a=n23, b=n24)` |
| 26 | breath, walking bob and look lag | `add(a=n22, b=n25)` |
| 27 | copied hipX | `read hipX` |
| 28 | constant -0.05 | `-0.05` |
| 29 |  | `mul(a=n12, b=n28)` |
| 30 | hip plus sprint | `add(a=n27, b=n29)` |
| 31 | constant -0.06 | `-0.06` |
| 32 | reload or loading offset, with crossbow crank | `mul(a=n13, b=n31)` |
| 33 | hip, sprint and loading | `add(a=n30, b=n32)` |
| 34 | idle motion added | `add(a=n33, b=n26)` |
| 35 | constant -0.25 | `-0.25` |
| 36 |  | `mul(a=n5, b=n35)` |
| 37 |  | `add(a=n0, b=n36)` |
| 38 | portrait framing | `mul(a=n34, b=n37)` |
| 39 | copied adsMotion | `read adsMotion` |
| 40 |  | `mul(a=n26, b=n39)` |
| 41 | copied adsX | `read adsX` |
| 42 | native ADS solve plus damped motion and recoil | `add(a=n41, b=n40)` |
| 43 |  | `gt(a=n7, b=n1)` |
| 44 |  | `sub(a=n42, b=n38)` |
| 45 |  | `mul(a=n44, b=n7)` |
| 46 |  | `add(a=n38, b=n45)` |
| 47 | hip to ADS blend | `select(test=n43, yes=n46, no=n38)` |
| 48 | copied inspect | `read inspect` |
| 49 |  | `gt(a=n48, b=n1)` |
| 50 | constant 0.02 | `0.02` |
| 51 | inspection override | `select(test=n49, yes=n50, no=n47)` |
| 52 | previous visual pose | `local 0` |
| 53 | first frame completed | `local 1` |
| 54 |  | `clock.delta` |
| 55 | constant 14 | `14` |
| 56 |  | `mul(a=n54, b=n55)` |
| 57 |  | `min(a=n0, b=n56)` |
| 58 | first frame or original follow rate | `select(test=n53, yes=n57, no=n0)` |
| 59 |  | `sub(a=n51, b=n52)` |
| 60 |  | `mul(a=n59, b=n58)` |
| 61 | smoothed output | `add(a=n52, b=n60)` |

## crossbow.pose.y

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied reloadTilt | `read reloadTilt` |
| 14 | constant 1.1 | `1.1` |
| 15 |  | `mul(a=n2, b=n14)` |
| 16 |  | `sin(a=n15)` |
| 17 | constant 0.002 | `0.002` |
| 18 |  | `mul(a=n16, b=n17)` |
| 19 |  | `sin(a=n3)` |
| 20 |  | `abs(a=n19)` |
| 21 |  | `neg(a=n20)` |
| 22 | constant 0.012 | `0.012` |
| 23 |  | `mul(a=n21, b=n22)` |
| 24 |  | `mul(a=n23, b=n4)` |
| 25 |  | `add(a=n18, b=n24)` |
| 26 | copied lagPitch | `read lagPitch` |
| 27 | constant 0.2 | `0.2` |
| 28 |  | `mul(a=n26, b=n27)` |
| 29 | breath, walking bob and look lag | `add(a=n25, b=n28)` |
| 30 | copied hipY | `read hipY` |
| 31 | constant -0.09 | `-0.09` |
| 32 |  | `mul(a=n12, b=n31)` |
| 33 | hip plus sprint | `add(a=n30, b=n32)` |
| 34 | constant -0.05 | `-0.05` |
| 35 | reload or loading offset, with crossbow crank | `mul(a=n13, b=n34)` |
| 36 | hip, sprint and loading | `add(a=n33, b=n35)` |
| 37 | idle motion added | `add(a=n36, b=n29)` |
| 38 | constant 0.015 | `0.015` |
| 39 |  | `mul(a=n6, b=n38)` |
| 40 | recoil added | `add(a=n37, b=n39)` |
| 41 |  | `mul(a=n5, b=n9)` |
| 42 |  | `add(a=n0, b=n41)` |
| 43 | portrait framing | `mul(a=n40, b=n42)` |
| 44 | copied adsMotion | `read adsMotion` |
| 45 |  | `mul(a=n29, b=n44)` |
| 46 | copied adsY | `read adsY` |
| 47 |  | `add(a=n46, b=n45)` |
| 48 | constant 0.01 | `0.01` |
| 49 |  | `mul(a=n6, b=n48)` |
| 50 | native ADS solve plus damped motion and recoil | `add(a=n47, b=n49)` |
| 51 |  | `gt(a=n7, b=n1)` |
| 52 |  | `sub(a=n50, b=n43)` |
| 53 |  | `mul(a=n52, b=n7)` |
| 54 |  | `add(a=n43, b=n53)` |
| 55 | hip to ADS blend | `select(test=n51, yes=n54, no=n43)` |
| 56 | copied inspect | `read inspect` |
| 57 |  | `gt(a=n56, b=n1)` |
| 58 | constant -0.02 | `-0.02` |
| 59 | inspection override | `select(test=n57, yes=n58, no=n55)` |
| 60 | copied holster | `read holster` |
| 61 |  | `sample(a=n60, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 62 | constant -0.32 | `-0.32` |
| 63 |  | `mul(a=n61, b=n62)` |
| 64 | inspection and holster applied | `add(a=n59, b=n63)` |
| 65 | previous visual pose | `local 0` |
| 66 | first frame completed | `local 1` |
| 67 |  | `clock.delta` |
| 68 | constant 14 | `14` |
| 69 |  | `mul(a=n67, b=n68)` |
| 70 |  | `min(a=n0, b=n69)` |
| 71 | first frame or original follow rate | `select(test=n66, yes=n70, no=n0)` |
| 72 |  | `sub(a=n64, b=n65)` |
| 73 |  | `mul(a=n72, b=n71)` |
| 74 | smoothed output | `add(a=n65, b=n73)` |

## crossbow.pose.z

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied reloadTilt | `read reloadTilt` |
| 14 | copied hipZ | `read hipZ` |
| 15 | constant 0.04 | `0.04` |
| 16 |  | `mul(a=n12, b=n15)` |
| 17 | hip plus sprint | `add(a=n14, b=n16)` |
| 18 | constant 0.02 | `0.02` |
| 19 | reload or loading offset, with crossbow crank | `mul(a=n13, b=n18)` |
| 20 | hip, sprint and loading | `add(a=n17, b=n19)` |
| 21 | constant 0.07 | `0.07` |
| 22 |  | `mul(a=n6, b=n21)` |
| 23 | recoil added | `add(a=n20, b=n22)` |
| 24 | constant 1.5 | `1.5` |
| 25 |  | `mul(a=n5, b=n24)` |
| 26 |  | `add(a=n0, b=n25)` |
| 27 | portrait framing | `mul(a=n23, b=n26)` |
| 28 | copied adsMotion | `read adsMotion` |
| 29 |  | `mul(a=n1, b=n28)` |
| 30 | copied adsZ | `read adsZ` |
| 31 | constant 0.015 | `0.015` |
| 32 |  | `mul(a=n6, b=n31)` |
| 33 | native ADS solve plus damped motion and recoil | `add(a=n30, b=n32)` |
| 34 |  | `gt(a=n7, b=n1)` |
| 35 |  | `sub(a=n33, b=n27)` |
| 36 |  | `mul(a=n35, b=n7)` |
| 37 |  | `add(a=n27, b=n36)` |
| 38 | hip to ADS blend | `select(test=n34, yes=n37, no=n27)` |
| 39 | copied inspect | `read inspect` |
| 40 |  | `gt(a=n39, b=n1)` |
| 41 | constant -0.42 | `-0.42` |
| 42 | inspection override | `select(test=n40, yes=n41, no=n38)` |
| 43 | copied holster | `read holster` |
| 44 |  | `sample(a=n43, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 45 | constant 0.08 | `0.08` |
| 46 |  | `mul(a=n44, b=n45)` |
| 47 | inspection and holster applied | `add(a=n42, b=n46)` |
| 48 | previous visual pose | `local 0` |
| 49 | first frame completed | `local 1` |
| 50 |  | `clock.delta` |
| 51 | constant 14 | `14` |
| 52 |  | `mul(a=n50, b=n51)` |
| 53 |  | `min(a=n0, b=n52)` |
| 54 | first frame or original follow rate | `select(test=n49, yes=n53, no=n0)` |
| 55 |  | `sub(a=n47, b=n48)` |
| 56 |  | `mul(a=n55, b=n54)` |
| 57 | smoothed output | `add(a=n48, b=n56)` |

## crossbow.pose.pitch

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied reloadTilt | `read reloadTilt` |
| 14 | constant 2 | `2` |
| 15 |  | `mul(a=n3, b=n14)` |
| 16 |  | `sin(a=n15)` |
| 17 | constant 0.01 | `0.01` |
| 18 |  | `mul(a=n16, b=n17)` |
| 19 |  | `mul(a=n18, b=n4)` |
| 20 | copied lagPitch | `read lagPitch` |
| 21 | breath, walking bob and look lag | `add(a=n19, b=n20)` |
| 22 | copied hipPitch | `read hipPitch` |
| 23 | constant 0.32 | `0.32` |
| 24 |  | `mul(a=n12, b=n23)` |
| 25 | hip plus sprint | `add(a=n22, b=n24)` |
| 26 | constant 0.35 | `0.35` |
| 27 |  | `mul(a=n13, b=n26)` |
| 28 | copied reloadProgress | `read reloadProgress` |
| 29 | copied reloading | `read reloading` |
| 30 | constant 0.15 | `0.15` |
| 31 |  | `gt(a=n28, b=n30)` |
| 32 |  | `mul(a=n29, b=n31)` |
| 33 | constant 0.8 | `0.8` |
| 34 |  | `gt(a=n33, b=n28)` |
| 35 |  | `mul(a=n32, b=n34)` |
| 36 | constant 43.982297150257104 | `43.982297150257104` |
| 37 |  | `mul(a=n28, b=n36)` |
| 38 |  | `sin(a=n37)` |
| 39 |  | `select(test=n35, yes=n38, no=n1)` |
| 40 | constant 0.008 | `0.008` |
| 41 |  | `mul(a=n39, b=n40)` |
| 42 | reload or loading offset, with crossbow crank | `add(a=n27, b=n41)` |
| 43 | hip, sprint and loading | `add(a=n25, b=n42)` |
| 44 | idle motion added | `add(a=n43, b=n21)` |
| 45 | constant 0.12 | `0.12` |
| 46 |  | `mul(a=n6, b=n45)` |
| 47 | recoil added | `add(a=n44, b=n46)` |
| 48 | copied adsMotion | `read adsMotion` |
| 49 |  | `mul(a=n21, b=n48)` |
| 50 | copied adsPitch | `read adsPitch` |
| 51 |  | `add(a=n50, b=n49)` |
| 52 | constant 0.1 | `0.1` |
| 53 |  | `mul(a=n6, b=n52)` |
| 54 | native ADS solve plus damped motion and recoil | `add(a=n51, b=n53)` |
| 55 |  | `gt(a=n7, b=n1)` |
| 56 |  | `sub(a=n54, b=n47)` |
| 57 |  | `mul(a=n56, b=n7)` |
| 58 |  | `add(a=n47, b=n57)` |
| 59 | hip to ADS blend | `select(test=n55, yes=n58, no=n47)` |
| 60 | copied inspect | `read inspect` |
| 61 |  | `gt(a=n60, b=n1)` |
| 62 | inspection override | `select(test=n61, yes=n26, no=n59)` |
| 63 | copied holster | `read holster` |
| 64 |  | `sample(a=n63, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 65 | constant -0.55 | `-0.55` |
| 66 |  | `mul(a=n64, b=n65)` |
| 67 | inspection and holster applied | `add(a=n62, b=n66)` |
| 68 | previous visual pose | `local 0` |
| 69 | first frame completed | `local 1` |
| 70 |  | `clock.delta` |
| 71 | constant 14 | `14` |
| 72 |  | `mul(a=n70, b=n71)` |
| 73 |  | `min(a=n0, b=n72)` |
| 74 | first frame or original follow rate | `select(test=n69, yes=n73, no=n0)` |
| 75 |  | `sub(a=n67, b=n68)` |
| 76 |  | `mul(a=n75, b=n74)` |
| 77 | smoothed output | `add(a=n68, b=n76)` |

## crossbow.pose.yaw

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied reloadTilt | `read reloadTilt` |
| 14 | copied lagYaw | `read lagYaw` |
| 15 | copied hipYaw | `read hipYaw` |
| 16 | constant 0.45 | `0.45` |
| 17 |  | `mul(a=n12, b=n16)` |
| 18 | hip plus sprint | `add(a=n15, b=n17)` |
| 19 | constant -0.28 | `-0.28` |
| 20 | reload or loading offset, with crossbow crank | `mul(a=n13, b=n19)` |
| 21 | hip, sprint and loading | `add(a=n18, b=n20)` |
| 22 | idle motion added | `add(a=n21, b=n14)` |
| 23 | copied adsMotion | `read adsMotion` |
| 24 | native ADS solve plus damped motion and recoil | `mul(a=n14, b=n23)` |
| 25 |  | `gt(a=n7, b=n1)` |
| 26 |  | `sub(a=n24, b=n22)` |
| 27 |  | `mul(a=n26, b=n7)` |
| 28 |  | `add(a=n22, b=n27)` |
| 29 | hip to ADS blend | `select(test=n25, yes=n28, no=n22)` |
| 30 | copied inspect | `read inspect` |
| 31 |  | `gt(a=n30, b=n1)` |
| 32 | constant 0.9 | `0.9` |
| 33 | constant 0.25 | `0.25` |
| 34 |  | `mul(a=n2, b=n33)` |
| 35 |  | `sin(a=n34)` |
| 36 | constant 0.5 | `0.5` |
| 37 |  | `mul(a=n35, b=n36)` |
| 38 |  | `add(a=n32, b=n37)` |
| 39 | inspection override | `select(test=n31, yes=n38, no=n29)` |
| 40 | previous visual pose | `local 0` |
| 41 | first frame completed | `local 1` |
| 42 |  | `clock.delta` |
| 43 | constant 14 | `14` |
| 44 |  | `mul(a=n42, b=n43)` |
| 45 |  | `min(a=n0, b=n44)` |
| 46 | first frame or original follow rate | `select(test=n41, yes=n45, no=n0)` |
| 47 |  | `sub(a=n39, b=n40)` |
| 48 |  | `mul(a=n47, b=n46)` |
| 49 | smoothed output | `add(a=n40, b=n48)` |

## crossbow.pose.roll

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied reloadTilt | `read reloadTilt` |
| 14 | constant 0.5 | `0.5` |
| 15 |  | `mul(a=n2, b=n14)` |
| 16 |  | `sin(a=n15)` |
| 17 | constant 0.006 | `0.006` |
| 18 |  | `mul(a=n16, b=n17)` |
| 19 |  | `cos(a=n3)` |
| 20 | constant 0.02 | `0.02` |
| 21 |  | `mul(a=n19, b=n20)` |
| 22 |  | `mul(a=n21, b=n4)` |
| 23 | breath, walking bob and look lag | `add(a=n18, b=n22)` |
| 24 | copied hipRoll | `read hipRoll` |
| 25 | constant -0.15 | `-0.15` |
| 26 |  | `mul(a=n12, b=n25)` |
| 27 | hip plus sprint | `add(a=n24, b=n26)` |
| 28 | constant 0.42 | `0.42` |
| 29 |  | `mul(a=n13, b=n28)` |
| 30 | copied reloadProgress | `read reloadProgress` |
| 31 | copied reloading | `read reloading` |
| 32 | constant 0.15 | `0.15` |
| 33 |  | `gt(a=n30, b=n32)` |
| 34 |  | `mul(a=n31, b=n33)` |
| 35 | constant 0.8 | `0.8` |
| 36 |  | `gt(a=n35, b=n30)` |
| 37 |  | `mul(a=n34, b=n36)` |
| 38 | constant 43.982297150257104 | `43.982297150257104` |
| 39 |  | `mul(a=n30, b=n38)` |
| 40 |  | `sin(a=n39)` |
| 41 |  | `select(test=n37, yes=n40, no=n1)` |
| 42 | constant 0.012 | `0.012` |
| 43 |  | `mul(a=n41, b=n42)` |
| 44 | reload or loading offset, with crossbow crank | `add(a=n29, b=n43)` |
| 45 | hip, sprint and loading | `add(a=n27, b=n44)` |
| 46 | idle motion added | `add(a=n45, b=n23)` |
| 47 | constant -0.03 | `-0.03` |
| 48 |  | `mul(a=n6, b=n47)` |
| 49 | recoil added | `add(a=n46, b=n48)` |
| 50 | copied adsMotion | `read adsMotion` |
| 51 |  | `mul(a=n23, b=n50)` |
| 52 | constant -0.02 | `-0.02` |
| 53 |  | `mul(a=n6, b=n52)` |
| 54 | native ADS solve plus damped motion and recoil | `add(a=n51, b=n53)` |
| 55 |  | `gt(a=n7, b=n1)` |
| 56 |  | `sub(a=n54, b=n49)` |
| 57 |  | `mul(a=n56, b=n7)` |
| 58 |  | `add(a=n49, b=n57)` |
| 59 | hip to ADS blend | `select(test=n55, yes=n58, no=n49)` |
| 60 | copied inspect | `read inspect` |
| 61 |  | `gt(a=n60, b=n1)` |
| 62 | constant 0.1 | `0.1` |
| 63 | inspection override | `select(test=n61, yes=n62, no=n59)` |
| 64 | copied holster | `read holster` |
| 65 |  | `sample(a=n64, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 66 | constant 0.25 | `0.25` |
| 67 |  | `mul(a=n65, b=n66)` |
| 68 | inspection and holster applied | `add(a=n63, b=n67)` |
| 69 | previous visual pose | `local 0` |
| 70 | first frame completed | `local 1` |
| 71 |  | `clock.delta` |
| 72 | constant 14 | `14` |
| 73 |  | `mul(a=n71, b=n72)` |
| 74 |  | `min(a=n0, b=n73)` |
| 75 | first frame or original follow rate | `select(test=n70, yes=n74, no=n0)` |
| 76 |  | `sub(a=n68, b=n69)` |
| 77 |  | `mul(a=n76, b=n75)` |
| 78 | smoothed output | `add(a=n69, b=n77)` |

## lever.pose.x

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied loadBlend | `read loadBlend` |
| 14 |  | `sample(a=n13, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 15 |  | `mul(a=n2, b=n9)` |
| 16 |  | `sin(a=n15)` |
| 17 | constant 0.0025 | `0.0025` |
| 18 |  | `mul(a=n16, b=n17)` |
| 19 |  | `cos(a=n3)` |
| 20 | constant 0.014 | `0.014` |
| 21 |  | `mul(a=n19, b=n20)` |
| 22 |  | `mul(a=n21, b=n4)` |
| 23 |  | `add(a=n18, b=n22)` |
| 24 | copied lagYaw | `read lagYaw` |
| 25 | constant 0.25 | `0.25` |
| 26 |  | `mul(a=n24, b=n25)` |
| 27 | breath, walking bob and look lag | `add(a=n23, b=n26)` |
| 28 | copied hipX | `read hipX` |
| 29 | constant -0.06 | `-0.06` |
| 30 |  | `mul(a=n12, b=n29)` |
| 31 | hip plus sprint | `add(a=n28, b=n30)` |
| 32 | constant -0.05 | `-0.05` |
| 33 | reload or loading offset, with crossbow crank | `mul(a=n14, b=n32)` |
| 34 | hip, sprint and loading | `add(a=n31, b=n33)` |
| 35 | idle motion added | `add(a=n34, b=n27)` |
| 36 | copied cycle | `read cycle` |
| 37 | copied cycleX | `read cycleX` |
| 38 |  | `mul(a=n36, b=n37)` |
| 39 | lever cycle cant added | `add(a=n35, b=n38)` |
| 40 | constant -0.35 | `-0.35` |
| 41 |  | `mul(a=n5, b=n40)` |
| 42 |  | `add(a=n0, b=n41)` |
| 43 | portrait framing | `mul(a=n39, b=n42)` |
| 44 | copied adsMotion | `read adsMotion` |
| 45 |  | `mul(a=n27, b=n44)` |
| 46 | copied adsX | `read adsX` |
| 47 | native ADS solve plus damped motion and recoil | `add(a=n46, b=n45)` |
| 48 |  | `gt(a=n7, b=n1)` |
| 49 |  | `sub(a=n47, b=n43)` |
| 50 |  | `mul(a=n49, b=n7)` |
| 51 |  | `add(a=n43, b=n50)` |
| 52 | hip to ADS blend | `select(test=n48, yes=n51, no=n43)` |
| 53 | copied inspect | `read inspect` |
| 54 |  | `gt(a=n53, b=n1)` |
| 55 |  | `select(test=n54, yes=n53, no=n0)` |
| 56 | inspection override | `select(test=n54, yes=n1, no=n52)` |
| 57 | previous visual pose | `local 0` |
| 58 | first frame completed | `local 1` |
| 59 |  | `clock.delta` |
| 60 | constant 16 | `16` |
| 61 |  | `mul(a=n59, b=n60)` |
| 62 |  | `min(a=n0, b=n61)` |
| 63 |  | `select(test=n58, yes=n62, no=n0)` |
| 64 | first frame or original follow rate | `select(test=n54, yes=n0, no=n63)` |
| 65 |  | `sub(a=n56, b=n57)` |
| 66 |  | `mul(a=n65, b=n64)` |
| 67 | smoothed output | `add(a=n57, b=n66)` |

## lever.pose.y

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied loadBlend | `read loadBlend` |
| 14 |  | `sample(a=n13, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 15 | constant 1.1 | `1.1` |
| 16 |  | `mul(a=n2, b=n15)` |
| 17 |  | `sin(a=n16)` |
| 18 | constant 0.002 | `0.002` |
| 19 |  | `mul(a=n17, b=n18)` |
| 20 |  | `sin(a=n3)` |
| 21 |  | `abs(a=n20)` |
| 22 |  | `neg(a=n21)` |
| 23 | constant 0.011 | `0.011` |
| 24 |  | `mul(a=n22, b=n23)` |
| 25 |  | `mul(a=n24, b=n4)` |
| 26 |  | `add(a=n19, b=n25)` |
| 27 | copied lagPitch | `read lagPitch` |
| 28 | constant 0.2 | `0.2` |
| 29 |  | `mul(a=n27, b=n28)` |
| 30 | breath, walking bob and look lag | `add(a=n26, b=n29)` |
| 31 | copied hipY | `read hipY` |
| 32 | constant -0.08 | `-0.08` |
| 33 |  | `mul(a=n12, b=n32)` |
| 34 | hip plus sprint | `add(a=n31, b=n33)` |
| 35 | constant 0.01 | `0.01` |
| 36 | reload or loading offset, with crossbow crank | `mul(a=n14, b=n35)` |
| 37 | hip, sprint and loading | `add(a=n34, b=n36)` |
| 38 | idle motion added | `add(a=n37, b=n30)` |
| 39 | constant 0.012 | `0.012` |
| 40 |  | `mul(a=n6, b=n39)` |
| 41 | recoil added | `add(a=n38, b=n40)` |
| 42 | copied cycle | `read cycle` |
| 43 | copied cycleY | `read cycleY` |
| 44 |  | `mul(a=n42, b=n43)` |
| 45 | lever cycle cant added | `add(a=n41, b=n44)` |
| 46 | constant 0.25 | `0.25` |
| 47 |  | `mul(a=n5, b=n46)` |
| 48 |  | `add(a=n0, b=n47)` |
| 49 | portrait framing | `mul(a=n45, b=n48)` |
| 50 | copied adsMotion | `read adsMotion` |
| 51 |  | `mul(a=n30, b=n50)` |
| 52 | copied adsY | `read adsY` |
| 53 |  | `add(a=n52, b=n51)` |
| 54 | constant 0.008 | `0.008` |
| 55 |  | `mul(a=n6, b=n54)` |
| 56 |  | `add(a=n53, b=n55)` |
| 57 | constant -0.03 | `-0.03` |
| 58 |  | `mul(a=n42, b=n57)` |
| 59 | copied scale | `read scale` |
| 60 |  | `mul(a=n58, b=n59)` |
| 61 | native ADS solve plus damped motion and recoil | `add(a=n56, b=n60)` |
| 62 |  | `gt(a=n7, b=n1)` |
| 63 |  | `sub(a=n61, b=n49)` |
| 64 |  | `mul(a=n63, b=n7)` |
| 65 |  | `add(a=n49, b=n64)` |
| 66 | hip to ADS blend | `select(test=n62, yes=n65, no=n49)` |
| 67 | copied inspect | `read inspect` |
| 68 |  | `gt(a=n67, b=n1)` |
| 69 | copied holster | `read holster` |
| 70 |  | `sample(a=n69, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 71 | constant -0.3 | `-0.3` |
| 72 |  | `mul(a=n70, b=n71)` |
| 73 |  | `add(a=n66, b=n72)` |
| 74 |  | `select(test=n68, yes=n67, no=n0)` |
| 75 | constant -0.02 | `-0.02` |
| 76 | inspection override | `select(test=n68, yes=n75, no=n73)` |
| 77 | previous visual pose | `local 0` |
| 78 | first frame completed | `local 1` |
| 79 |  | `clock.delta` |
| 80 | constant 16 | `16` |
| 81 |  | `mul(a=n79, b=n80)` |
| 82 |  | `min(a=n0, b=n81)` |
| 83 |  | `select(test=n78, yes=n82, no=n0)` |
| 84 | first frame or original follow rate | `select(test=n68, yes=n0, no=n83)` |
| 85 |  | `sub(a=n76, b=n77)` |
| 86 |  | `mul(a=n85, b=n84)` |
| 87 | smoothed output | `add(a=n77, b=n86)` |

## lever.pose.z

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied loadBlend | `read loadBlend` |
| 14 |  | `sample(a=n13, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 15 | copied hipZ | `read hipZ` |
| 16 | constant 0.05 | `0.05` |
| 17 |  | `mul(a=n12, b=n16)` |
| 18 | hip plus sprint | `add(a=n15, b=n17)` |
| 19 | reload or loading offset, with crossbow crank | `mul(a=n14, b=n16)` |
| 20 | hip, sprint and loading | `add(a=n18, b=n19)` |
| 21 | constant 0.07 | `0.07` |
| 22 |  | `mul(a=n6, b=n21)` |
| 23 | recoil added | `add(a=n20, b=n22)` |
| 24 | copied cycle | `read cycle` |
| 25 | copied cycleZ | `read cycleZ` |
| 26 |  | `mul(a=n24, b=n25)` |
| 27 | lever cycle cant added | `add(a=n23, b=n26)` |
| 28 | constant 0.35 | `0.35` |
| 29 |  | `mul(a=n5, b=n28)` |
| 30 |  | `add(a=n0, b=n29)` |
| 31 | portrait framing | `mul(a=n27, b=n30)` |
| 32 | copied adsMotion | `read adsMotion` |
| 33 |  | `mul(a=n1, b=n32)` |
| 34 | copied adsZ | `read adsZ` |
| 35 | constant 0.03 | `0.03` |
| 36 |  | `mul(a=n6, b=n35)` |
| 37 |  | `add(a=n34, b=n36)` |
| 38 | constant 0.02 | `0.02` |
| 39 |  | `mul(a=n24, b=n38)` |
| 40 | native ADS solve plus damped motion and recoil | `add(a=n37, b=n39)` |
| 41 |  | `gt(a=n7, b=n1)` |
| 42 |  | `sub(a=n40, b=n31)` |
| 43 |  | `mul(a=n42, b=n7)` |
| 44 |  | `add(a=n31, b=n43)` |
| 45 | hip to ADS blend | `select(test=n41, yes=n44, no=n31)` |
| 46 | copied inspect | `read inspect` |
| 47 |  | `gt(a=n46, b=n1)` |
| 48 | copied holster | `read holster` |
| 49 |  | `sample(a=n48, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 50 | constant 0.06 | `0.06` |
| 51 |  | `mul(a=n49, b=n50)` |
| 52 |  | `add(a=n45, b=n51)` |
| 53 |  | `select(test=n47, yes=n46, no=n0)` |
| 54 | constant -1.15 | `-1.15` |
| 55 |  | `div(a=n54, b=n53)` |
| 56 | inspection override | `select(test=n47, yes=n55, no=n52)` |
| 57 | previous visual pose | `local 0` |
| 58 | first frame completed | `local 1` |
| 59 |  | `clock.delta` |
| 60 | constant 16 | `16` |
| 61 |  | `mul(a=n59, b=n60)` |
| 62 |  | `min(a=n0, b=n61)` |
| 63 |  | `select(test=n58, yes=n62, no=n0)` |
| 64 | first frame or original follow rate | `select(test=n47, yes=n0, no=n63)` |
| 65 |  | `sub(a=n56, b=n57)` |
| 66 |  | `mul(a=n65, b=n64)` |
| 67 | smoothed output | `add(a=n57, b=n66)` |

## lever.pose.pitch

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied loadBlend | `read loadBlend` |
| 14 |  | `sample(a=n13, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 15 | constant 2 | `2` |
| 16 |  | `mul(a=n3, b=n15)` |
| 17 |  | `sin(a=n16)` |
| 18 | constant 0.009 | `0.009` |
| 19 |  | `mul(a=n17, b=n18)` |
| 20 |  | `mul(a=n19, b=n4)` |
| 21 | copied lagPitch | `read lagPitch` |
| 22 | breath, walking bob and look lag | `add(a=n20, b=n21)` |
| 23 | copied hipPitch | `read hipPitch` |
| 24 | constant 0.3 | `0.3` |
| 25 |  | `mul(a=n12, b=n24)` |
| 26 | hip plus sprint | `add(a=n23, b=n25)` |
| 27 | constant 0.16 | `0.16` |
| 28 | reload or loading offset, with crossbow crank | `mul(a=n14, b=n27)` |
| 29 | hip, sprint and loading | `add(a=n26, b=n28)` |
| 30 | idle motion added | `add(a=n29, b=n22)` |
| 31 | constant 0.1 | `0.1` |
| 32 |  | `mul(a=n6, b=n31)` |
| 33 | recoil added | `add(a=n30, b=n32)` |
| 34 | copied cycle | `read cycle` |
| 35 | copied cyclePitch | `read cyclePitch` |
| 36 |  | `mul(a=n34, b=n35)` |
| 37 | lever cycle cant added | `add(a=n33, b=n36)` |
| 38 | copied adsMotion | `read adsMotion` |
| 39 |  | `mul(a=n22, b=n38)` |
| 40 | constant 0.06 | `0.06` |
| 41 |  | `mul(a=n6, b=n40)` |
| 42 |  | `add(a=n39, b=n41)` |
| 43 | constant -0.05 | `-0.05` |
| 44 |  | `mul(a=n34, b=n43)` |
| 45 | native ADS solve plus damped motion and recoil | `add(a=n42, b=n44)` |
| 46 |  | `gt(a=n7, b=n1)` |
| 47 |  | `sub(a=n45, b=n37)` |
| 48 |  | `mul(a=n47, b=n7)` |
| 49 |  | `add(a=n37, b=n48)` |
| 50 | hip to ADS blend | `select(test=n46, yes=n49, no=n37)` |
| 51 | copied inspect | `read inspect` |
| 52 |  | `gt(a=n51, b=n1)` |
| 53 | copied holster | `read holster` |
| 54 |  | `sample(a=n53, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 55 | constant -0.5 | `-0.5` |
| 56 |  | `mul(a=n54, b=n55)` |
| 57 |  | `add(a=n50, b=n56)` |
| 58 |  | `select(test=n52, yes=n51, no=n0)` |
| 59 | inspection override | `select(test=n52, yes=n1, no=n57)` |
| 60 | previous visual pose | `local 0` |
| 61 | first frame completed | `local 1` |
| 62 |  | `clock.delta` |
| 63 | constant 16 | `16` |
| 64 |  | `mul(a=n62, b=n63)` |
| 65 |  | `min(a=n0, b=n64)` |
| 66 |  | `select(test=n61, yes=n65, no=n0)` |
| 67 | first frame or original follow rate | `select(test=n52, yes=n0, no=n66)` |
| 68 |  | `sub(a=n59, b=n60)` |
| 69 |  | `mul(a=n68, b=n67)` |
| 70 | smoothed output | `add(a=n60, b=n69)` |

## lever.pose.yaw

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied loadBlend | `read loadBlend` |
| 14 |  | `sample(a=n13, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 15 | copied lagYaw | `read lagYaw` |
| 16 | copied hipYaw | `read hipYaw` |
| 17 | constant 0.5 | `0.5` |
| 18 |  | `mul(a=n12, b=n17)` |
| 19 | hip plus sprint | `add(a=n16, b=n18)` |
| 20 | constant -0.32 | `-0.32` |
| 21 | reload or loading offset, with crossbow crank | `mul(a=n14, b=n20)` |
| 22 | hip, sprint and loading | `add(a=n19, b=n21)` |
| 23 | idle motion added | `add(a=n22, b=n15)` |
| 24 | copied cycle | `read cycle` |
| 25 | copied cycleYaw | `read cycleYaw` |
| 26 |  | `mul(a=n24, b=n25)` |
| 27 | lever cycle cant added | `add(a=n23, b=n26)` |
| 28 | copied adsMotion | `read adsMotion` |
| 29 | native ADS solve plus damped motion and recoil | `mul(a=n15, b=n28)` |
| 30 |  | `gt(a=n7, b=n1)` |
| 31 |  | `sub(a=n29, b=n27)` |
| 32 |  | `mul(a=n31, b=n7)` |
| 33 |  | `add(a=n27, b=n32)` |
| 34 | hip to ADS blend | `select(test=n30, yes=n33, no=n27)` |
| 35 | copied inspect | `read inspect` |
| 36 |  | `gt(a=n35, b=n1)` |
| 37 |  | `select(test=n36, yes=n35, no=n0)` |
| 38 | copied inspectYaw | `read inspectYaw` |
| 39 | inspection override | `select(test=n36, yes=n38, no=n34)` |
| 40 | previous visual pose | `local 0` |
| 41 | first frame completed | `local 1` |
| 42 |  | `clock.delta` |
| 43 | constant 16 | `16` |
| 44 |  | `mul(a=n42, b=n43)` |
| 45 |  | `min(a=n0, b=n44)` |
| 46 |  | `select(test=n41, yes=n45, no=n0)` |
| 47 | first frame or original follow rate | `select(test=n36, yes=n0, no=n46)` |
| 48 |  | `sub(a=n39, b=n40)` |
| 49 |  | `mul(a=n48, b=n47)` |
| 50 | smoothed output | `add(a=n40, b=n49)` |

## lever.pose.roll

| Node | Meaning | Expression |
| --- | --- | --- |
| 0 | constant 1 | `1` |
| 1 | constant 0 | `0` |
| 2 | copied time | `read time` |
| 3 | copied bob | `read bob` |
| 4 | copied speed | `read speed` |
| 5 | copied portrait | `read portrait` |
| 6 | copied recoil | `read recoil` |
| 7 | copied ads | `read ads` |
| 8 | copied sprint | `read sprint` |
| 9 | constant 0.7 | `0.7` |
| 10 |  | `mul(a=n5, b=n9)` |
| 11 |  | `sub(a=n0, b=n10)` |
| 12 | portrait-weighted sprint | `mul(a=n8, b=n11)` |
| 13 | copied loadBlend | `read loadBlend` |
| 14 |  | `sample(a=n13, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 15 | constant 0.5 | `0.5` |
| 16 |  | `mul(a=n2, b=n15)` |
| 17 |  | `sin(a=n16)` |
| 18 | constant 0.006 | `0.006` |
| 19 |  | `mul(a=n17, b=n18)` |
| 20 |  | `cos(a=n3)` |
| 21 | constant 0.018 | `0.018` |
| 22 |  | `mul(a=n20, b=n21)` |
| 23 |  | `mul(a=n22, b=n4)` |
| 24 | breath, walking bob and look lag | `add(a=n19, b=n23)` |
| 25 | copied hipRoll | `read hipRoll` |
| 26 | constant -0.12 | `-0.12` |
| 27 |  | `mul(a=n12, b=n26)` |
| 28 | hip plus sprint | `add(a=n25, b=n27)` |
| 29 | constant -0.62 | `-0.62` |
| 30 | reload or loading offset, with crossbow crank | `mul(a=n14, b=n29)` |
| 31 | hip, sprint and loading | `add(a=n28, b=n30)` |
| 32 | idle motion added | `add(a=n31, b=n24)` |
| 33 | constant -0.02 | `-0.02` |
| 34 |  | `mul(a=n6, b=n33)` |
| 35 | recoil added | `add(a=n32, b=n34)` |
| 36 | copied cycle | `read cycle` |
| 37 | copied cycleRoll | `read cycleRoll` |
| 38 |  | `mul(a=n36, b=n37)` |
| 39 | lever cycle cant added | `add(a=n35, b=n38)` |
| 40 | copied adsMotion | `read adsMotion` |
| 41 |  | `mul(a=n24, b=n40)` |
| 42 | constant -0.012 | `-0.012` |
| 43 |  | `mul(a=n6, b=n42)` |
| 44 |  | `add(a=n41, b=n43)` |
| 45 | constant 0.06 | `0.06` |
| 46 |  | `mul(a=n36, b=n45)` |
| 47 | native ADS solve plus damped motion and recoil | `add(a=n44, b=n46)` |
| 48 |  | `gt(a=n7, b=n1)` |
| 49 |  | `sub(a=n47, b=n39)` |
| 50 |  | `mul(a=n49, b=n7)` |
| 51 |  | `add(a=n39, b=n50)` |
| 52 | hip to ADS blend | `select(test=n48, yes=n51, no=n39)` |
| 53 | copied inspect | `read inspect` |
| 54 |  | `gt(a=n53, b=n1)` |
| 55 | copied holster | `read holster` |
| 56 |  | `sample(a=n55, interpolation="smoothstep", keys=[[0,0],[1,1]])` |
| 57 | constant 0.2 | `0.2` |
| 58 |  | `mul(a=n56, b=n57)` |
| 59 |  | `add(a=n52, b=n58)` |
| 60 |  | `select(test=n54, yes=n53, no=n0)` |
| 61 | inspection override | `select(test=n54, yes=n1, no=n59)` |
| 62 | previous visual pose | `local 0` |
| 63 | first frame completed | `local 1` |
| 64 |  | `clock.delta` |
| 65 | constant 16 | `16` |
| 66 |  | `mul(a=n64, b=n65)` |
| 67 |  | `min(a=n0, b=n66)` |
| 68 |  | `select(test=n63, yes=n67, no=n0)` |
| 69 | first frame or original follow rate | `select(test=n54, yes=n0, no=n68)` |
| 70 |  | `sub(a=n61, b=n62)` |
| 71 |  | `mul(a=n70, b=n69)` |
| 72 | smoothed output | `add(a=n62, b=n71)` |
