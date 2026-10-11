/** Read the native quest kit, ordered prompts, sight owners, reward and zipline before any frame. */
export function readDriftwoodSpots(adv, shell, registry) {
    const rows = adv.kit.lives.map(lv => {
      // the barrel at its home (where the kit spawned its body), never where the body has settled since (it jitters by 1e-5)
      const d = lv.def, at = d.kind === 'barrel' ? lv.home : lv.position, row = { id: d.id, kind: d.kind, x: at.x, y: at.y, z: at.z, yaw: lv.yaw };
      if (lv.prompt) row.prompt = { x: lv.prompt.position.x, y: lv.prompt.position.y, z: lv.prompt.position.z };
      if (lv.collider && d.kind === 'door') row.collider = { x: lv.collider.x, z: lv.collider.z, hw: lv.collider.hw, hd: lv.collider.hd, rot: lv.collider.rot, yTop: lv.collider.yTop, yBottom: lv.collider.yBottom };
      return row;
    });
    // the two prompts that are not table rows, by their labels at load (the sword's while the sailor guards it)
    const prompts = shell.interactables.map(p => ({ label: p.label, x: p.position.x, y: p.position.y, z: p.position.z, radius: p.radius }));
    const talk = prompts.filter(p => p.label === 'Talk to Wendell'), sword = prompts.filter(p => /iron sword|guards the rack/u.test(p.label));
    if (talk.length !== 1 || sword.length !== 1) throw new Error(`Driftwood prompts: ${JSON.stringify(prompts.map(p => p.label))}`);
    const reward = adv.finale.rewardAt, pose = adv.finale.rewardPose, zip = adv.zipline;
    const registered = registry.pieceList();
    const ownerId = owner => {
      if (typeof owner === 'string') return `string:${owner}`;
      const piece = registered.find(p => p === owner);
      if (piece === undefined) throw new Error('Prompt sight owner is not an actual registered piece');
      return `piece:${piece.id}`;
    };
    const ids = new Map(adv.kit.lives.filter(lv => lv.prompt !== null).map(lv => [lv.prompt, lv.def.id]));
    for (const prompt of shell.interactables) {
      if (prompt.label === 'Talk to Wendell') ids.set(prompt, 'castaway.talk');
      if (/iron sword|guards the rack/u.test(prompt.label)) ids.set(prompt, 'iron-sword');
    }
    ids.set(zip.prompt, 'zipline');
    const promptRegistrations = shell.interactables.map(prompt => {
      const sight = prompt.sight;
      const row = { id: ids.get(prompt) ?? null, position: { x: prompt.position.x, y: prompt.position.y, z: prompt.position.z }, radius: prompt.radius,
        sight: { slack: sight?.slack ?? 0.5 } };
      if (prompt.weak !== undefined) row.weak = prompt.weak;
      if (sight?.body !== undefined && sight.body !== null) row.sight.body = ownerId(sight.body);
      return row;
    });
    if (!pose || !zip?.lay?.spec) throw new Error('Driftwood reward/zipline capture port missing');
    const point = p => ({ x: p.x, y: p.y, z: p.z });
    const zipline = { top: point(zip.lay.spec.top), bottom: point(zip.lay.spec.bottom), sag: zip.lay.spec.sag ?? 1.6,
      prompt: { ...point(zip.prompt.position), radius: zip.prompt.radius } };
    return { rows, talk: talk[0], sword: sword[0], reward: { x: reward.x, y: reward.y, z: reward.z, yaw: pose.yaw, pitch: pose.pitch, phase: pose.phase }, zipline, promptRegistrations };
}
