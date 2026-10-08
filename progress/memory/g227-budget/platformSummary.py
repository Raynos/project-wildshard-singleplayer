# Per-piece actual resource attribution. Shared resources are listed once; view absence is not lifetime permission.
import json, pathlib, sys
path = pathlib.Path(sys.argv[1]); report = json.loads(path.read_text())
s = report['snapshots'][-1]
roots = {row['uuid']: row for row in s['roots'] if row.get('uuid') is not None}
textures = {row['uuid']: row for row in s['census']['textures']}
resources = [row for c in s['census']['gl'] for row in c['resources']]
owned = []
for row in resources:
    tex = textures.get(row.get('sceneTextureUuid'))
    ids = [ident for ident in tex.get('objectIds', []) if ident in roots] if tex else []
    # Buffer labels carry the mesh name, while shared textures use exact recorded scene-object identities.
    candidates = [r for r in roots.values() if ('/' + r['name'] + '/') in row['asset']] if row['kind'] == 'buffer' else []
    users = [roots[i] for i in ids] if ids else candidates
    if not users: continue
    owned.append({'id': row['id'], 'kind': row['kind'], 'bytes': row['bytes'], 'asset': row['asset'],
        'mapping': 'exact texture-to-object identity' if ids else 'buffer label / possibly shared mesh name',
        'users': [{'uuid':u['uuid'],'owner':u['owner'],'visible':u['visible'],'inFrustum':u.get('inFrustum')} for u in users],
        'allUsersOutsideCurrentView': all(not u['visible'] or u.get('inFrustum') is False for u in users)})
summary = {'version':report['version'],'pose':s['label'],'camera':s.get('camera'),'roadView':s.get('roadView'),
    'note':'One current view, not proof of invisibility after a turn/hover. Shared texture bytes listed once. Buffer mesh-name associations are explicitly weaker than texture object identity. No off-view bytes are claimed released.',
    'claims':[c for c in s['residency']['claims'] if c['id'].startswith('platform:render:')],
    'roots':list(roots.values()),'resources':owned,'uniqueGpuBytes':sum(r['bytes'] for r in owned),
    'currentlyOffViewGpuBytes':sum(r['bytes'] for r in owned if r['allUsersOutsideCurrentView'])}
out=path.with_name(path.stem+'.platform.json');out.write_text(json.dumps(summary,indent=2)+'\n');print(out)
