# Horse riding — how the big games do it (N17 research)

Research for ask N17 (2026-09-24): our horse strafes like a walking player, the camera ignores the horse's
heading and the head snaps on turns. None of the big riding games work that way. In every one of them
(RDR2, KCD I/II, Oblivion, Bannerlord/Warband, Witcher 3, Zelda, Ghost of Tsushima, Elden Ring, AC)
**the stick is a rein**: forward means go, back means slow or rein back, sideways means turn the horse.
Nobody strafes. **Speed is a separate, stepped input**, a "spur" button tapped to go up a gait and held to
keep it, with its own brake input. Gallop costs **horse stamina**; walk, trot and canter are usually free.
Speed is carried by **inertia**. RDR2 says outright that it drives acceleration and deceleration
continuously, never as a hard switch between gait speeds. Turning **pivots about the front feet / chest**,
with a lateral "drift" component and a rate that falls as speed rises. On a road or path the horse
**follows it by itself** when you don't steer (RDR2, KCD, Witcher 3, Zelda, AC, Horizon).

The first-person camera is where the games disagree, and the complaints point to the answer. RDR2's first
person is pure free-look, and its players call it "impossible to steer". Skyrim ties the camera to steering,
and its players call that annoying too. KCD recentres the view behind the horse's head whenever the mouse is
idle (cvar default 0.2), which players dislike only because it fights them during combat. Bannerlord keeps
the mouse on the view and aim, puts steering on A/D, and has a blind spot behind the left shoulder.

Taken together, these suggest a camera that is **heading-locked with a free-look offset that springs back
after a short idle**. That is an inference. Cinemachine's default recentre, 1 s wait and 2 s to centre, is a
reasonable starting point.

Real horse speeds, as a sanity scale: walk ~1.9 m/s, trot ~3.6 m/s, canter 4.4–7.5 m/s,
gallop 11–13 m/s [S1]. RDR2's fastest horses reach almost 18 m/s [S2].

---

## Red Dead Redemption 2 (Rockstar, 2018): the reference

**Input mapping (controller)** [S3][S4][S5]
- Left stick steers. Forward alone gives a walk.
- **A/X spurs.** A tap steps up one gait ("tap to change speed"). A hold keeps the current speed, which is
  also how you match a companion's speed. Double-tap then hold matches speed from standstill [S5].
- **RB/R1 brakes.** A tap slows a little and a hold slows hard, stepping gallop → canter → trot → walk.
  Double-tap, or tap then hold, reins back (walks backwards) [S4].
- On PC, a Shift tap raises speed and holding Shift gallops. A Ctrl tap slows gradually and holding Ctrl
  stops [S5].
- Spurring in rhythm with the hoofbeats uses less stamina. Players report that well-timed taps hold a
  gallop at almost no stamina cost [S4][S6]. L3 (the stick click) calms and pats the horse, which restores
  its stamina bar mid-ride [S6].
- Bond levels unlock moves: 2 = rear at a standstill, 3 = **skid turn / skid stop** (brake + spur while
  moving), 4 = piaffe and "drift" (a lateral sidestep with the stick) [S7].
- The horse has two bars, health and stamina, sitting on "cores". A gallop drains the stamina bar and the
  cores drain over time [S6].

**Locomotion (GDC 2021, Tobias Kleanthous, the slide deck)** [S2][S8]
- The first pass had "Discrete speeds, no range … Stiff turns, C-shape posing, lumpy and inconsistent
  transitions". Rockstar's verdict on it: "Not a car, not a bike."
- **Turning:** "1. Pivot, roughly about front feet/under chest. 2. Turn assisted via lateral adjustment."
  Lateral movement is "a movement required by horses for tight turning". Rockstar filmed real horses
  side-stepping and leaning into a turn before they turn [S8].
- **"Drift" happens in three stages.**
  1. There is a loose range of lateral movement with little change in orientation.
  2. Once the movement direction passes a threshold, the lateral range widens and angular velocity rises.
  3. Once angular velocity passes the level the horse can sustain, the horse "overturns" beyond its
     direction of movement.

  Rockstar's summary: "notion of indirect control but consistent responsiveness."
- **Gait versus speed:** Rockstar dropped the tight coupling of gait to speed and uses gaits "for
  representing effort". Each gait (walk, trot, canter, gallop) has a min, ideal and max speed range, and
  the ranges overlap.
- **Continuous acceleration and deceleration:** speed changes independently of gait changes, so a
  transition's duration isn't tied to its animation.
  - Deceleration pose: "more collected, compressed legs and body, **head up**".
  - Acceleration pose: "extended legs and body, **head down**".
- "Don't. STOP. Moving.": starts and stops are loops. The rules are "Retain AI and Player control at all
  times" and "Support indecision".
- Rider sync: canter and gallop are three-beat gaits with irregular front-foot intervals. The rider is
  driven from the horse's locomotion data but "interpolated independently … No 1-1 requirement for horse and
  rider" [S2][S9].
- Environment: "Fastest horses almost 18 m/s (40 mph)". Terrain applies "speed penalties" on top of the
  speed.
  - The controller is forward-integrated into a path, which is validated against the navmesh and physics.
  - Avoidance makes the horse strafe slightly to a safer path.
  - **Cliff stopping overrides player input**, using cliff edges tagged by hand [S2][S9].
- Breed differences are all controller tuning: "Acceleration and deceleration, Angular responsiveness,
  Preferred speed ranges per gait" [S2].

**Camera**
- Third-person PC has a setting, "Keyboard and Mouse Horse Control": *Camera Relative* (the default, where
  mouse-look also turns the horse) or *Horse Relative* (the mouse is free-look and the keys steer).
  Shacknews recommends Horse Relative for aiming [S10][S4].
- **First person is pure free-look.** "If I … steer left, the horse head goes left and the horse turns left
  but my view stays straight unless I move my mouse" [S11]. Players call it "clunky"; the thread is titled
  "Impossible to steer the horse in 1st person" [S12]. No setting locks the view to the heading. There is
  "First Person Aim Auto-Center (Mount/Vehicle)", but it only resets the view once, on mounting [S13].
- Other first-person settings:
  - "First Person Horse Riding" on/off. Off switches to third person on mount, "if you get disoriented or
    sick" [S13].
  - "First Person Head Bobbing", where reviewers recommend *Reduced*: "the default … is really a bit too
    much" [S13].
- Cinematic camera (hold View/Touchpad): with a waypoint set and no steering input, the horse follows the
  road by itself while you spur [S14].

**Mounted aiming:** the right stick aims, RT fires, and LT+RS is Dead Eye (slow time) [S3]. The horse keeps
its speed while you aim. Hold A to hold speed (observation, from the controls above).

## Kingdom Come: Deliverance I and II (Warhorse, 2018 / 2025): first person only

- **Controls on PC:** W forward, A/D **turn**, S slows and stops. LShift spurs to canter and gallop, and
  KCD2 adds LCtrl to slow down [S15][S16].
  - On a controller, R3 (the right stick click) spurs [S17].
  - The mouse only moves Henry's head: "use the mouse to look around (moving Henry's head) while mounted"
    [S15].
- **Gaits:** trot, canter and gallop, shown by an icon above the stamina bar [S16].
- **Stamina:** the horse's stamina bar replaces the enemy health bar on the HUD while riding [S17].
  - Each spur raises the horse's "resolve", which sets how long it gallops on its own before slowing.
  - A yellow over-spur bar fills as you spur. Over-spurring when it is full or when stamina is empty
    **bucks you off** [S16][S17].
  - The horses' stats (Speed ~40–41, Stamina 169–231, Courage 14–15) are listed in [S16].
- **Path following:** "If you ride along a path, you won't have to turn. Your horse will follow the path
  on its own" [S16]. In KCD1, a single Shift tap gives a canter that "will try to stay on the path" (how well
  depends on Horsemanship skill), and a held Shift gives full player steering [S15].
- **Camera:** the view **auto-recentres behind the horse** when the mouse is released. The cvar is
  `wh_horse_CameraCentering`, default **0.2**; 0 disables it [S18]. Players complain that "the view resets if
  you let go of the mouse" and that they **can't look behind** on horseback (a yaw clamp) [S19]. Mods to
  disable centring exist for both games, because centring fights mounted combat [S18].
- **Mounted combat:** attack from the horse's right side and keep the target about 45° ahead. Longswords
  and polearms work, but two-handers are poor. Players hit-and-run: strike at a canter, gallop away, then
  circle back [S20]. Horseback archery is "very hard" [S20].

## The Elder Scrolls: Oblivion (2006) and Skyrim (2011)

- **Oblivion** allowed first person on horseback natively (the View key while mounted) [S21]. The
  Remaster forces third person, and fans want first person back [S22].
  - Steering is **WASD only**: "The mouse pointer has no effect on horse direction, and is simply you
    looking around while riding" [S21].
  - The sprint key gallops. There is no horse stamina and no mounted combat [S21].
- **Skyrim** forces third person on horseback. First person needs mods [S23]. Here the camera steers: "when
  riding your camera changes the horse's direction, unlike games like Red Dead Redemption where the camera
  is free to look around". This is a common complaint [S24].
  - Pulling back doesn't reverse the horse; it **turns it around** [S25].
  - Sprint gallops briefly on the horse's own stamina pool (Stamina 106) [S25].
  - Mounted melee and bow arrived in patch 1.6, with one-handed swings to both sides [S25][S26].

## Mount & Blade: Warband and Bannerlord (TaleWorlds): first-person-capable mounted combat

- **Controls:** "W A S D control the horse's speed and turning". To back up, stop and then hold S (the
  horse reverses slowly). The **mouse controls the camera and aim, never the heading** [S27][S28]. Players
  mostly hold W and steer with A/D [S29].
- **Look-behind limit:** "a blind spot behind your left shoulder where you cannot block or attack". You can
  point the camera into it, but the aim clamps to its left or right edge [S27].
- **Horse stats** (Warband, [S30]):
  - Speed runs 37–50 (Sumpter 37, Courser 50).
  - **Maneuver** runs 39–54 (Steppe 51, Sarranid 54).
  - "A horse with a higher maneuver value will make sharper turns **and accelerate faster**" [S31].
  - In other words, turn rate and acceleration are one stat, traded against top speed.
  - "Horses in Mount & Blade II do not turn very sharply, which is more realistic" [S32].
- **Mounted melee:** "pass your enemies on the left while swinging your weapon to the right". A swing to
  the left side reaches less far [S27]. Speed raises damage through the "speed bonus" (relative speed)
  [S27].
- **Couched lance:** ride at speed without attacking and the lance lowers by itself. It lifts after a hit or
  when the horse slows. The top-speed hit one-shots, and it is "easier to aim in first-person view" [S27].
- **Horse archery:** the reticle grows with speed. Slowing down before a shot or raising the skill shrinks
  it [S27].

## The Witcher 3 (CD Projekt, 2015): third person, but the gait scheme is widely copied

- Walk is "the slowest but most maneuverable". Holding the run button canters, which is free (no stamina).
  To gallop, tap and then hold, as a double-press within ~0.4 s [S33][S34].
- Galloping drains stamina. When stamina runs out the horse drops to a walk until it recovers [S33].
- **Road autopilot:** "while on a road, hold the run button to canter without touching directional sticks,
  and the horse will automatically follow the road". It may pick the wrong branch at intersections [S33].
- Horses have a fear or "spook" meter: near monsters, the horse throws you [S33].

## Zelda: Breath of the Wild and Tears of the Kingdom (Nintendo)

- **Four gaits: walk, trot, canter, gallop** [S35].
  - Walk is the only gait that can reverse.
  - **Canter is the fastest gait that costs no stamina.**
  - A gallop spends one **spur**. It is a short full-speed burst, and afterwards the horse falls back to a
    canter [S35].
- Press A ("Yah!") with the stick forward to speed up, and "Whoa…" to slow down [S35]. A horse's number of
  spurs comes from its stamina stat, and used spurs regenerate over time [S36].
- **Bond:** a well-bonded horse "will travel along roads without needing direction". You redirect a horse
  that veers off with the stick, then reward it with the soothe button [S36]. In TotK a horse on a road
  "will naturally run along the path without requiring any control" [S37].
- Speeds: the Giant Horse can't gallop but has the fastest canter in the game, **14.8 m/s** [S38].
- **Mounted bow:** you can aim while riding, but it is hard to aim well. The standard technique is to jump
  off the horse and shoot in the slow-motion mid-air aim [S37].

## Ghost of Tsushima (Sucker Punch, 2020): third person

- The left stick steers. Stick deflection blends walk ↔ trot. L3 (or Shift) gallops, and "Pressing L3 to
  accelerate to a gallop feels pretty satisfying" [S39][S40].
  - There is **no canter step**, only trot or gallop [S39].
  - The equestrian reviewer finds the stick-blended walk tiring, because holding a steady walk "requires
    active concentration" [S41].
- Galloping drains the horse's stamina, and on empty the horse drops to a trot [S39].
- You mount and dismount without stopping ("buttery smooth and intuitive"). The horse can't be damaged; when
  attacked it just runs off [S41][S42].
- There is a dismount attack from horseback (Triangle), and the Iki DLC adds the "Horse Charge"
  (hold L1) [S42][S43].
- **Navigation:** swipe up on the touchpad to summon the **Guiding Wind**, a world-space pointer to the
  goal in place of a minimap [S44]. It is a touch gesture that fits phones (our inference).

## Elden Ring: Torrent (FromSoftware, 2022)

- Walking on Torrent is about as fast as running on foot. Dash gallops, and **mashing dash** raises speed
  further, roughly doubling it [S45].
- Torrent can double-jump. Pressing L3 at a gallop leaps you off into a jumping attack [S45].
- Reviewers call it "responsive", but PC Gamer criticised Torrent's "large turning radius" [S46]. Players use
  the turning radius of the Tree Sentinel and Night's Cavalry against them [S45].
- **Camera:** when you start riding, the camera auto-pans to the direction of travel [S47].

## Assassin's Creed Origins, Odyssey and Valhalla; Horizon

- AC Valhalla: hold X/Square to **follow the road**, or press Y/Triangle to auto-ride to the map marker. A
  marker in front of the horse shows the path it will take [S48]. Odyssey has the same auto-travel [S48].
- Horizon Zero Dawn: press sprint once to walk, twice to trot and three times to gallop. There is an
  option to have mounts stick to roads [S49].

## Shadow of the Colossus: Agro (Team Ico, 2005): indirect control as a design goal

- You control Wander, never the horse directly. You "spur" and "pull the reins to one side or the other".
  Agro "can refuse to do certain actions (such as falling off a cliff)" and takes small jumps on its own
  initiative [S50]. The stated goal is to keep immersion "while giving Agro his own personality" [S50].
  RDR2 does the same with its cliff stop [S2].

---

## Common mechanics

| Mechanic | What the games do | Typical numbers |
|---|---|---|
| Stick forward | Walk, or accelerate toward the gait you have selected. It never commands top speed directly | — |
| Stick sideways | **Turns the horse** (yaw rate). No game strafes. RDR2 blends in a small lateral "drift" for tight turns [S2] | Turn rate falls with speed. Warband/Bannerlord tie turn rate and acceleration to one "maneuver" stat [S31] |
| Stick back | Slows or reins back. Only from a standstill does it walk backwards slowly (Warband, RDR2, BotW). Skyrim turns the horse around instead [S25] | Reverse speed is about a slow walk (obs.) |
| Turn at standstill | **Pivots about the front feet / chest** (RDR2) [S2] | Tight turns at walk, wide at gallop (Torrent is criticised for its radius) |
| Speed input | A separate **spur** button: a tap steps up a gait and a hold keeps it (RDR2, KCD, Witcher, BotW, GoT, Elden Ring, Horizon). There is a separate brake (RDR2 RB, KCD2 Ctrl) | Witcher: a double-press within 0.4 s gallops [S34] |
| Gaits | Walk, trot, canter, gallop (RDR2, BotW). Trot, canter, gallop (KCD). Walk, canter, gallop (Witcher). Walk/trot, gallop (GoT) | Real: 1.9, 3.6, 4.4–7.5, 11–13 m/s [S1]. RDR2 top: ~18 m/s [S2]. BotW Giant canter: 14.8 m/s [S38] |
| Stamina | Only the gallop drains it. Canter is free (BotW, Witcher). Spur rhythm saves stamina (RDR2). Over-spurring bucks you off (KCD) | BotW spurs: 1–5 by stat. PUBG Mobile war horse: max-speed burst of 45–60 s (low confidence) [S51] |
| Inertia | Speed is continuous and eases between gaits. Gaits overlap in speed (RDR2). Skid stop is a trick unlocked late (RDR2 bond 3) | Numbers are not published. Inference: 1–2 s from walk to gallop, 1.5–3 s from gallop to stop |
| Head / neck | The head leads the turn and the body follows. Head **down** on acceleration and **up** when collecting to slow (RDR2 poses) [S2] | — |
| Path following | With no steering input on a road, the horse follows it (RDR2 cinematic, KCD, Witcher, Zelda, AC, Horizon) | — |
| Self-preservation | The horse refuses cliffs, overriding input (RDR2, SotC), and sidesteps obstacles (RDR2) | — |
| FP camera yaw | Free-look (RDR2, where players hate it). Camera = steering (Skyrim, also disliked). **Auto-recentre behind the head** (KCD) | KCD centring speed: 0.2 (unitless cvar) [S18]. Cinemachine default: 1 s wait, 2 s to centre [S52] |
| Look-behind | Clamped (KCD complaint; Warband blind spot behind the left shoulder) [S19][S27] | Inference: ~±120–150° of yaw from the horse's heading |
| Head bob | On, but tuned down. RDR2 offers "Reduced" and reviewers recommend it. Sickness reports come from **camera swerve on turns** (Tales of Rein Ravine) and **bounce at the run** (Far Far West) [S13][S53][S54] | Guideline: 30–60 % of "realistic" bob [S55] |
| Mounted bow | The horse keeps its speed and heading while you aim. Accuracy falls with speed (M&B reticle bloom). Some games slow time (RDR2 Dead Eye, Zelda's jump-off) | PUBG Mobile: ADS on horseback costs 30 % of speed (low confidence) [S51] |
| Mounted melee | Pass the target on the correct side and strike on that side (M&B: pass on the left, swing right. KCD: attack on the right, about 45° ahead). Speed adds damage | — |

## Touch / mobile schemes

Direct sources are thin here. Most mobile riding copies the dual-stick console scheme.

- **Red Dead Redemption (Netflix mobile, Dec 2025):** RDR1 ported with a redesigned touch UI [S56][S57].
  Players say riding "works smoothly" but takes practice. The failure they name is that "it's so easy to
  accidentally move the camera instead of the player/horse" [S57]. Our inference: the camera drag and the
  steering need clearly separated zones, or the camera should recentre by itself so drags are rarely needed.
- **PUBG Mobile war horse** (low confidence; an SEO guide, [S51]):
  - Left joystick moves and the right side is camera/aim.
  - A **sprint button gives burst speed**, and jump has a 2 s cooldown.
  - Speed tiers are 40, 72 and 90 km/h, and the top tier drains energy.
- **Rival Stars Horse Racing (mobile):** a **timed sprint tap**. Tapping right after the speed bar flashes
  gives a "PERFECT" boost, and stamina is managed through taps [S58]. In the VR edition you pull back on the
  left or right controller to turn that way, like reins [S58]. The timed tap is RDR2's rhythm spur, turned
  into a touch mechanic.
- **Black Desert:** holding sprint keeps a high speed. An "instant accel" burst and a directional "drift"
  are mount skills [S59]. It also has map-click **auto-path** [S59]. Its mobile version has the same
  features, but we found no touch-layout source.
- **Ghost of Tsushima's swipe-up wind** [S44] is a gesture that maps straight onto a phone swipe (our
  inference).
- **Infinity Nikki** mobile: a player-selectable "Joystick Mode" (fixed or floating) followed community
  pushback [S60]. Our inference: make the joystick type a setting.

Inferred touch mapping that follows from the above. This is not sourced:
- Left thumb: a **virtual stick used as reins**. Its x axis sets turn rate and its y axis
  accelerates or brakes.
- Right thumb: a **SPUR button** (tap to go up a gait, hold to keep it) above a **REIN/brake**.
- The rest of the right half is a look-drag that springs back on release.
- A no-input state that follows the path suits one-thumb play in portrait.

## Sources

1. [S1] Wikipedia, "Horse gait": https://en.wikipedia.org/wiki/Horse_gait
2. [S2] T. Kleanthous, "Making The Believable Horses Of Red Dead Redemption II", GDC 2021 slides:
   https://gta.com.ua/img/news/making-horses-rdr2-gdc2021.pdf (the GDC Vault page:
   https://gdcvault.com/play/1027113/AI-Summit-Making-the-Believable ; the video:
   https://www.youtube.com/watch?v=8vtCqfFAjKQ)
3. [S3] Prima Games, RDR2 controls: https://primagames.com/tips/red-dead-redemption-2-controls
4. [S4] RDR2.org forum, horse controls tips: https://www.rdr2.org/forums/topic/1509-horse-controls-tips-and-tricks/
5. [S5] PwrDown, RDR2 brake / slow down: https://www.pwrdown.com/gaming/red-dead-redemption-2-how-to-brake-slow-down-on-horse/
6. [S6] Red Dead Wiki user blog, horse cores and rhythm: https://reddead.fandom.com/wiki/User_blog:JollyRogerOver/RDR2_for_Dummies_5
   (also GameFAQs: https://gamefaqs.gamespot.com/boards/200179-red-dead-redemption-2/78113945)
7. [S7] RDR2 horse bonding: https://reddeadredemption2.wiki.fextralife.com/Horse_Bonding ,
   https://www.themanequest.com/blog/2018/11/11/dressage-moves-in-red-dead-redemption-ii-and-their-real-life-equivalents
8. [S8] GDC news, "Hoof it to GDC": https://gdconf.com/news/hoof-it-gdc-and-see-how-red-dead-redemption-2s-horses-were-brought-life
9. [S9] Game Developer, "Rockstar's quest for the ultimate video game horse": https://www.gamedeveloper.com/design/rockstar-s-quest-for-the-ultimate-video-game-horse
10. [S10] Shacknews, fixing RDR2 PC horse controls: https://www.shacknews.com/article/114938/how-to-fix-horse-controls-in-read-dead-redemption-2-on-pc
11. [S11] RDR2.org forum, first-person horseback on PC: https://www.rdr2.org/forums/topic/7687-first-person-view-horseback-view-and-controls-how-pc/
12. [S12] Steam, "Impossible to steer the horse in 1st person mode": https://steamcommunity.com/app/1174180/discussions/0/3050610473991311274/
13. [S13] GameRevolution, RDR2 settings: https://www.gamerevolution.com/guides/450339-best-way-to-play-red-dead-redemption-2
14. [S14] Steam, RDR2 cinematic / match speed: https://steamcommunity.com/app/1174180/discussions/0/1735507550899738407/ ;
    GameSpot, following trails: https://www.gamespot.com/articles/red-dead-2-guide-heres-how-to-set-your-horse-to-fo/1100-6462864/
15. [S15] KCD forum, horse controls for PC: https://forum.kingdomcomerpg.com/t/horse-controls-for-pc/42453
16. [S16] KCD2 wiki, Horses: https://kingdomcomedeliverance2.wiki.fextralife.com/Horses
17. [S17] GameRant, riding in KCD2: https://gamerant.com/kingdom-come-deliverance-2-kcd2-how-call-use-horse/
18. [S18] Nexus, KCD "No Camera Auto-Centering While On Horseback" (wh_horse_CameraCentering, default 0.2):
    https://www.nexusmods.com/kingdomcomedeliverance/mods/269 ; KCD2: https://www.nexusmods.com/kingdomcomedeliverance2/mods/70
19. [S19] KCD forum, horse camera: https://forum.kingdomcomerpg.com/t/horse-camera/27123
20. [S20] KCD2 horseback combat: https://www.dtgre.com/2025/05/kcd2-best-horseback-combat-skills-guide.html ;
    KCD forum thread: https://forum.kingdomcomerpg.com/t/horseback-fighting-discussion-thread/43082
21. [S21] UESP, Oblivion: Horses: https://en.uesp.net/wiki/Oblivion:Horses
22. [S22] TheGamer, Oblivion Remastered's scrapped first-person horse: https://www.thegamer.com/oblivion-remastered-scrapped-first-person-horse-mechanic/
23. [S23] Nexus, Skyrim SE "First Person Horse Riding": https://www.nexusmods.com/skyrimspecialedition/mods/15314
24. [S24] Nexus, Skyrim SE "Horse Riding Camera Tweak" and its comments: https://www.nexusmods.com/skyrimspecialedition/mods/22915
25. [S25] UESP, Skyrim: Horse: https://en.uesp.net/wiki/Skyrim:Horse
26. [S26] Elder Scrolls wiki, horse combat blog: https://elderscrolls.fandom.com/wiki/User_blog:Danbuscus/Horse_Combat_(Skyrim)
27. [S27] StrategyWiki, Mount&Blade / Mounted: https://strategywiki.org/wiki/Mount%26Blade/Mounted
28. [S28] Mount & Blade wiki, Controls: https://mountandblade.fandom.com/wiki/Controls
29. [S29] Steam, Bannerlord "Horse controls": https://steamcommunity.com/app/261550/discussions/0/4233889512144112767/
30. [S30] StrategyWiki, Warband horses: https://strategywiki.org/wiki/Mount%26Blade:_Warband/Horses
31. [S31] Mount & Blade wiki, Horses (maneuver): https://mountandblade.fandom.com/wiki/Horses
32. [S32] MMORPG.com, Bannerlord PS5 controls: https://www.mmorpg.com/editorials/ps5-impression-mount-and-blade-2-bannerlord-controller-support-is-frustrating-2000126544
33. [S33] Ludo guide, Witcher 3 horse riding: https://www.ludo.guide/guide/the-witcher-3-wild-hunt/tips-advanced-strategies/tips-secrets/game-mechanics-explained/horse-riding
34. [S34] Nexus, Witcher 3 "Alternate Horse Sprint" (0.4 s double-press): https://www.nexusmods.com/witcher3/mods/5510 ;
    TheGamer, travelling guide: https://www.thegamer.com/the-witcher-3-travelling-guide/
35. [S35] Zeldapedia, Horse (gaits): https://zelda-archive.fandom.com/wiki/Horse
36. [S36] Zelda Dungeon wiki, Horse (BotW): https://www.zeldadungeon.net/wiki/Horse_(Breath_of_the_Wild)
37. [S37] GameWith, TotK horse guide: https://gamewith.net/zelda-totk/article/show/39465
38. [S38] TheGamer, best wild horses in BotW: https://www.thegamer.com/legend-of-zelda-breath-of-the-wild-best-wild-horses/
39. [S39] Ludo guide, GoT horse and travel: https://www.ludo.guide/guide/ghost-of-tsushima/getting-started-tips/tips-secrets/exploration-hidden-content/horse-travel
40. [S40] Steam, GoT "Can't sprint or gallop": https://steamcommunity.com/app/2215430/discussions/0/7093810350794850149/
41. [S41] The Mane Quest, "The Horses in Ghost of Tsushima": https://www.themanequest.com/blog/2023/5/1/the-horses-in-ghost-of-tsushima-wonderful-details-and-fundamental-problems
42. [S42] Samurai Gamers, GoT horse guide: https://samurai-gamers.com/ghost-of-tsushima/horse-guide/
43. [S43] GoT wiki, Horse Charge: https://ghostoftsushima.wiki.fextralife.com/Horse+Charge
44. [S44] GameRevolution, guiding wind: https://www.gamerevolution.com/guides/653064-how-to-use-the-guiding-wind-in-ghost-of-tsushima-ps4
45. [S45] Elden Ring wiki, Torrent: https://eldenring.wiki.fextralife.com/Torrent_(Spirit_Steed) ;
    Screen Rant, Torrent's speed trick: https://screenrant.com/elden-ring-torrent-run-fastest-secret-trick/
46. [S46] Wikipedia, Torrent (Elden Ring): https://en.wikipedia.org/wiki/Torrent_(Elden_Ring)
47. [S47] Fextralife forum, camera auto-panning: https://fextralife.com/forums/t584713/camera-auto-panning-up-issue
48. [S48] Game8, AC Valhalla controls: https://game8.co/games/Assassins-Creed-Valhalla/archives/306100 ;
    GamerTweak: https://gamertweak.com/ac-valhalla-horse-riding-guide/
49. [S49] GameFAQs, HZD mount speed: https://gamefaqs.gamespot.com/boards/168644-horizon-zero-dawn/75050096 ;
    GosuNoob: https://www.gosunoob.com/horizon-zero-dawn/mounts-overriding-enemies/
50. [S50] Game Developer, "The Art of Shadow of the Colossus (3/6): Designing Agro": https://www.gamedeveloper.com/design/the-art-of-shadow-of-the-colossus-3-6-designing-agro
51. [S51] BitTopup, PUBG Mobile war horse guide (low confidence): https://bittopup.com/article/PUBG-Mobile-War-Horse-Guide-41-Mounted-Combat-Spawns
52. [S52] Unity Cinemachine source, `RecenteringSettings.Default => { Wait = 1, Time = 2 }`:
    https://github.com/Unity-Technologies/com.unity.cinemachine/blob/main/com.unity.cinemachine/Runtime/Core/InputAxis.cs
53. [S53] Steam, Tales of Rein Ravine, motion sickness: https://steamcommunity.com/app/2299740/discussions/0/592882772895381777/
54. [S54] Steam, Far Far West, horse camera bounce: https://steamcommunity.com/app/3124540/discussions/0/837249359736263460/
55. [S55] GameDev.net, head-bob thread (30–60 % guideline): https://gamedev.net/forums/topic/719653-bodycam-style-realistic-head-bobbing-motion-for-first-person-controllers/5473084/ ;
    Playtank, "First-Person 3Cs: Camera": https://playtank.io/2023/05/12/first-person-3cs-camera/
56. [S56] TechCrunch, Netflix RDR mobile: https://techcrunch.com/2025/12/02/netflix-launches-a-mobile-friendly-version-of-red-dead-redemption
57. [S57] TechTimes, RDR mobile touch controls: https://www.techtimes.com/articles/313115/20251202/netflix-debuts-red-dead-redemption-mobile-complete-optimization-touch-controls.htm ;
    Digital Trends: https://www.digitaltrends.com/gaming/you-can-finally-play-red-dead-redemption-on-your-phone-thanks-to-netflix/
58. [S58] Level Winner, Rival Stars tips: https://www.levelwinner.com/rival-stars-horse-racing-guide-tips-cheats-tricks/ ;
    PikPok VR controls FAQ: https://faq.pikpok.com/hc/en-nz/articles/46118431075609-Rival-Stars-Horse-Racing-VR-Edition-FAQ-Controls-Help
59. [S59] Garmoth, BDO new player guide: https://garmoth.com/guides/post/new-player-guide ;
    Dottz, BDO horses: https://dottzgaming.com/other-games/beginners-guide-to-horses-in-bdo/
60. [S60] Infinity Nikki on X, joystick mode: https://x.com/InfinityNikkiEN/status/1873685790410330372

Access note: the fandom and Zelda Dungeon pages, and some Nexus and StrategyWiki pages, blocked direct
fetches. Their claims come from search-result excerpts of those pages. StrategyWiki [S27] and [S30] were read
in full.

## The Wildshard design

Built for N17 on 2026-09-24. The user picked the phone scheme "stick steers, camera follows" (up = urge faster through
walk → trot → canter, GALLOP disc for the sprint, down = slow / rein back, left / right = turn, tighter when slow; the
camera sits behind the horse's head and follows its turns; a right-thumb drag looks around and drifts back after ~1 s —
RDR2 / KCD first-person style). Code: `src/player/Mount.ts` (`drive`), `src/entities/species/horse.ts` (`turnLead`),
`src/ui/RideHUD.ts` + `src/ui/styles/ride.css`. Frames: `progress/nalati-riding/` (`scripts/nalati-ride-capture.mjs`).

**What we took from the games, and what we didn't**

- *The stick is a rein, in the horse's frame* (every game above). No strafing. The camera never sets the steering, so
  looking around never turns the horse. That rules out Skyrim's camera-steers scheme, which players dislike.
- *The view rides the horse* (KCD's `wh_horse_CameraCentering`, the fix players ask RDR2 for). The rider's body turns
  with the heading, and your look is an offset on top of it that eases back behind the ears. This answers the two
  complaints: "the horse turns left but my view stays straight" and "I'm still looking the wrong way".
- *Speed by how far the stick is pushed, not RDR2's tap-to-spur.* On a phone there is one thumb for the reins, and the
  user picked the held stick. The inertia (below) makes a full push pass through walk → trot → canter over about 2.5 s,
  so it still reads as urging the horse on. GALLOP stays a held disc (Shift on desktop) and is the only gait that costs
  STEED. That matches BotW and Witcher 3: the canter is free.
- *Turn rate falls with speed, eased in, with the head leading* (RDR2's GDC deck: pivot about the chest, the head
  first).
- *Comfort*: the head bob is about 60 % of the old amplitudes (RDR2's "Reduced" bob, the 30–60 % guideline). The turn
  lean is small, and the view takes only 30 % of the horse's slope pitch and roll: a rider balances upright.
- *Not built (left for later rows)*: the horse following a road by itself when you let go; a tap-rhythm spur; a skid
  stop. The look-behind clamp stays at ±170° (the research suggests ±120–150°) so the Parthian shot still works; that
  is the user's call.

**The controls**

| input | phone (portrait) | desktop |
|---|---|---|
| go / faster | stick in the forward sector (within ~67° of up): < 45 % walk · 45–85 % trot · > 85 % canter | W: trot, canter once held 0.9 s |
| turn | stick x (up-left / up-right = go and turn) | A / D |
| collected turn | stick beside you (the side sector): at most a trot; from a stand, a pivot on the spot at 0.6 m/s | A / D alone |
| slow / rein back | stick in the back sector: reins in hard, then backs up at 1.1 m/s | S |
| gallop | GALLOP disc (held, in JUMP's spot) | Shift (held) |
| look | right-thumb drag / LOOK pad: a free look ±170° off the heading | mouse |
| off | the HORSE tab on the right edge reads DISMOUNT in the saddle | E |

The stick's sector is decided by its y against 0.38 × its length. HOVER is hidden while you ride; on foot the right-edge
tab is HORSE again.

**The numbers** (`Mount.ts` constants)

- Turn rate at full rein, blended by speed: stand 1.5 rad/s (86°/s) · walk 1.35 · trot 1.1 · canter 0.85 · gallop
  0.62 rad/s (a ~21 m radius at 13 m/s). It eases toward the rein with a rate of 4.5 /s (~0.22 s). While you draw the
  bow the rein turns at 60 %.
- Speed: 3.6 m/s² up to a canter (0 → 8.5 m/s in ~2.4 s), then 2.2 m/s² to the 13 m/s gallop. Letting go coasts down at
  3.2 m/s² (a gallop to a stop in ~4 s, ~26 m). Reining back stops at 8 m/s² (~10 m from a gallop).
- Free look: the view carries the heading's change every frame. After 1.2 s untouched at a walk, down to 0.8 s at a
  gallop (×0.6 while you steer), the offset eases back at a rate of 1.1 + 0.14 × speed /s. That is ~0.6 s to settle at
  a canter: measured 70° → 30° → 7° → 1.5° at +1.2 / 1.8 / 2.4 s. Pitch eases to level at 70 % of that rate. It does
  not recentre at a stand, while you draw or aim, or while a lock-on steers the view.
- Neck lead: `mem.turnLead` = the rein's rate ÷ 1.5 (−1..1), eased at 3.2 /s in horse.ts. The neck bends up to 0.4 rad
  and the head 0.16 rad into the turn before the body's turn catches up. A pivot shows it most; at a gallop the lead is
  smaller.
- Rider eye: 2.3 m × the horse's scale over the saddle, tilted with the horse's mesh on a slope. Bob: walk 0.016 m +
  0.014 m side sway · trot 0.032 · canter 0.045 + 0.022 rad rock · gallop 0.038. Lean into a turn: 0.05 rad per rad/s,
  scaled by speed up to 8 m/s (~1.8° in a galloping turn).

**Engine fixes found on the way** (these broke riding since main's Rapier merge, whatever the tuning):
`Player.step` / `Player.update` now skip while `ride` is set. They had been posing the camera at the on-foot eye, inside
the horse's neck, which is where the "HORSE · 1 M" plate came from. The rider's capsule is off in the saddle:
`Player.setBodyEnabled` gates on `ride`. `CreatureBodies.cast` skips hidden creatures, so `pastRidden` works against
the physics hitboxes again. The horse is still driven from a heading / yaw-rate / speed state in one place (`drive`),
so it can move onto its own physics body in the fixed step later.
