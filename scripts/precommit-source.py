"""Exact staged text inputs for the five-second commit checks; no build assets."""
import json
from contextlib import contextmanager
from collections.abc import Mapping
import os
from pathlib import Path, PurePosixPath
import runpy
import re
import subprocess
import sys
import time

TEXT = {'.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json', '.jsonc',
        '.yaml', '.yml', '.css', '.glsl', '.frag', '.vert', '.wgsl', '.as', '.py', '.sh', '.html'}
ROOTS = {'src', 'scripts', 'test', 'lint', 'vite', 'budgets', '.github', 'admin', 'api', 'drafts'}


@contextmanager
def git_blobs(repo, entries, deadline):
    """Load only selected immutable blobs; keep the Git batch stream bounded."""
    process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=repo,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    class Blobs(Mapping):
        def __init__(self):
            self.oids = {str(path): oid for path, oid, _ in entries}
            self.loaded = {}
        def __iter__(self):
            return iter(self.oids)
        def __len__(self):
            return len(self.oids)
        def __contains__(self, name):
            return name in self.oids
        def __getitem__(self, name):
            if name in self.loaded:
                return self.loaded[name]
            if time.time() >= deadline:
                raise TimeoutError('Staged source preparation exceeded five-second budget')
            oid = self.oids[name]
            process.stdin.write(oid + b'\n'); process.stdin.flush()
            header = process.stdout.readline().split()
            if len(header) != 3 or header[0] != oid or header[1] != b'blob':
                raise ValueError('Staged source batch returned an invalid Git blob')
            data = process.stdout.read(int(header[2]))
            if process.stdout.read(1) != b'\n':
                raise ValueError('Staged source batch truncated a Git blob')
            self.loaded[name] = data
            return data
    try:
        yield Blobs()
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait()
        process.stdout.close()


@contextmanager
def import_reader():
    # The dependency is installed once; source always comes from the exact Git
    # blobs supplied over stdin, never TypeScript's working-tree file loader.
    library = next((parent / 'node_modules/@typescript/typescript6' for parent in Path(__file__).resolve().parents
                    if (parent / 'node_modules/@typescript/typescript6').exists()), None)
    if library is None:
        raise ValueError('Staged input selection requires the installed TypeScript parser')
    program = """const ts=require(process.argv[1]);
const lines=require('node:readline').createInterface({input:process.stdin});
lines.on('line',line=>{
 const [name,text]=JSON.parse(line),source=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true),imports=[];
 function visit(node){
  if(ts.isImportTypeNode(node))return;
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
   if(node.isTypeOnly||node.importClause?.isTypeOnly)return;
   if(node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
  }
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
   const arg=node.arguments[0];if(arg&&ts.isStringLiteral(arg))imports.push(arg.text);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);process.stdout.write(JSON.stringify(imports)+'\\n');
});"""
    process = subprocess.Popen(['node', '-e', program, str(library)], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, text=True)
    def read(name, text):
        process.stdin.write(json.dumps([name, text]) + '\n'); process.stdin.flush()
        line = process.stdout.readline()
        if not line:
            raise ValueError('Staged import parser exited without a result')
        return set(json.loads(line))
    try:
        yield read
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait()
        process.stdout.close()


# Pure staged input selection; callers supply immutable Git blobs, never loose source.
def required_sources(blobs, specification, tree=None, executable=None):
    def regular(name):
        path = PurePosixPath(name)
        return not path.is_absolute() and '..' not in path.parts
    selected = set(specification.get('files', [])) & blobs.keys()
    for name in blobs:
        if '/' not in name and (name.endswith(('.json', '.jsonc', '.yaml', '.yml')) or name.startswith('vitest.config.')):
            selected.add(name)
        if name.startswith('lint/') or re.fullmatch(r'src/[^/]+/package.json', name):
            selected.add(name)
    roots = ['scripts/precommit-checks.mjs', 'scripts/precommit-source.py', 'scripts/push_input_cache.py', *specification.get('files', []), *specification.get('guards', [])]
    if specification.get('guards'):
        roots.append('scripts/vitest-push-guards.config.ts')
    if specification.get('deleted'):
        # Every active tracked reader is an input to the deleted-path grep.
        selected.update(name for name in blobs if name.split('/')[0] in ROOTS)
    if specification.get('closed'):
        policy = json.loads(blobs.get('lint/ratchet.json', b'{}'))
        shards = set(policy.get('closedComponents', {})) | set(policy.get('closingComponents', {}))
        for name in blobs:
            path = PurePosixPath(name)
            if len(path.parts) > 3 and path.parts[:2] == ('src', 'shards') and path.parts[2] in shards:
                if path.suffix in {'.ts', '.tsx', '.glsl'} and '/generators/' not in name and not re.search(r'\.d\.ts$|\.(?:test|spec)\.tsx?$|/test/', name):
                    selected.add(name)
        catalogue = json.loads(blobs.get('scripts/generation-jobs.json', b'{"jobs":[]}'))
        selected.update(job['entry'] for job in catalogue['jobs'])
        selected.update(name for name in blobs if re.search(r'/(?:generators/)?bake-[^/]+\.(?:mjs|ts)$', name))
        selected.update(['scripts/generation-jobs.json', 'scripts/source-generation-outputs.json'])
    if 'test/schema-reference.test.ts' in specification.get('guards', []):
        for layer in ['sdk', 'format']:
            manifest = json.loads(blobs.get(f'src/{layer}/package.json', b'{}'))
            for target in manifest.get('exports', {}).values():
                if isinstance(target, str) and target.startswith('./'):
                    name = f'src/{layer}/{target[2:]}'
                    selected.add(name)
                    # The inventory reads every public source, but executes only schema modules.
                    if re.search(rb'\b\w+Schema\s*(?::[^=;]+)?=', blobs.get(name, b'')):
                        roots.append(name)
    available = set(blobs)
    if tree is not None:
        available.update(str(path.relative_to(tree)) for path in tree.rglob('*') if path.is_file())
    def exists(name):
        return name in available
    def resolve_specifier(source, value):
        if value.startswith('@wildshard/'):
            package, _, key = value[len('@wildshard/'):].partition('/')
            manifest = json.loads(blobs.get(f'src/{package}/package.json', b'{}'))
            target = manifest.get('exports', {}).get('./' + key if key else '.')
            base = f'src/{package}/{target[2:]}' if isinstance(target, str) and target.startswith('./') else ''
        elif value.startswith('.'):
            base = os.path.normpath(str(PurePosixPath(source).parent / value))
        elif value.startswith('/src/'):
            base = value[1:]
        else:
            base = value
        if not base or not regular(base):
            return None
        candidates = [base, *[base + suffix for suffix in ('.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.json')]]
        return next((name for name in candidates if exists(name)), None)
    pending = [name for name in selected if name.startswith('lint/') and PurePosixPath(name).suffix in {'.js', '.mjs'}] + roots
    visited = set()
    with import_reader() as imports:
        while pending:
            name = pending.pop()
            if name in visited or not regular(name) or not exists(name):
                continue
            visited.add(name); selected.add(name)
            data = blobs[name] if name in blobs else (tree / name).read_bytes()
            if PurePosixPath(name).suffix not in {'.ts', '.tsx', '.mts', '.js', '.mjs', '.cjs', '.json'}:
                continue
            if name.endswith('.json') and name != 'lint/platform-pending-users.json':
                continue
            text = data.decode('utf8')
            imported = set() if name.endswith('.json') else imports(name, text)
            # Import edges and literal file reads of the selected checker. False
            # positives are conservative inputs; unresolved files remain absent and
            # the checker refuses rather than reading another lane's working tree.
            for value in re.findall(r'''["']([^"'\n]+)["']''', text):
                value = value.split('?', 1)[0]
                dependency = resolve_specifier(name, value)
                if dependency is None and value.startswith(('game/', 'engine/', 'format/', 'sdk/')):
                    dependency = resolve_specifier(name, 'src/' + value)
                if dependency is not None:
                    selected.add(dependency)
                    # Literal data/source reads do not execute that file's imports.
                    child = value.startswith('scripts/') and PurePosixPath(value).suffix in {'.mjs', '.js', '.ts', '.py'}
                    if (value in imported or child) and dependency not in visited:
                        pending.append(dependency)
    if executable is not None:
        executable.update(visited)
    return selected & available


def staged_source(repo, tree, deadline, revision=None, specification=None):
    def git(*args, **kwargs):
        return subprocess.check_output(['git', *args], cwd=repo,
                                       timeout=max(.01, deadline - time.time()), **kwargs)
    tree.mkdir(parents=True, exist_ok=True)
    listed = git('ls-files', '--stage', '-z') if revision is None else git('ls-tree', '-rz', revision)
    entries = []
    records = []
    for row in listed.split(b'\0'):
        if not row:
            continue
        header, name = row.split(b'\t', 1)
        mode, middle, last = header.split()
        oid, stage = (middle, last) if revision is None else (last, b'0')
        if stage != b'0':
            raise ValueError('Commit checks require an unconflicted index')
        path = PurePosixPath(os.fsdecode(name))
        if path.is_absolute() or '..' in path.parts:
            raise ValueError('Unsafe staged source path')
        records.append(mode + b' blob ' + oid + b'\t' + name)
        selected = len(path.parts) == 1 or path.parts[0] in ROOTS and path.suffix in TEXT or str(path) == 'docs/HOST-BAR.md'
        if selected:
            if mode == b'120000':
                raise ValueError('Commit source snapshot refuses symlinks: ' + str(path))
            entries.append((path, oid, mode))
    with git_blobs(repo, entries, deadline) as contents:
        executable = set()
        selected = set(contents) if specification is None else required_sources(contents, specification, executable=executable)
        for path, _, mode in entries:
            if str(path) not in selected:
                continue
            if time.time() >= deadline:
                raise TimeoutError('Staged source preparation exceeded five-second budget')
            target = tree / str(path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents[str(path)])
            if mode == b'100755':
                target.chmod(0o755)
        (tree / '.push-tracked.json').write_text(json.dumps([os.fsdecode(row.split(b'\t', 1)[1]) for row in records]))
        # Tests may use the newest verified generation, never loose shared outputs.
        # This does not establish a current-source type proof.
        revision = None
        cache = Path(__file__).resolve().parent / 'push_input_cache.py'
        full_generation = specification is None or 'test/manifest-declarations.test.ts' in specification.get('guards', [])
        if cache.exists() and (repo / 'tmp/push-input-cache/entries.json').exists():
            revision = runpy.run_path(str(cache))['restore_tests'](repo, tree, records,
                time.monotonic() + max(0, min(deadline - time.time(), .75)),
                include=None if full_generation else lambda name: name == 'lint/shard-words.generated.json')
        if specification is not None and revision is not None:
            if full_generation:
                selected = required_sources(contents, specification, tree, executable)
            selected.update(str(path.relative_to(tree)) for path in (tree / 'lint').rglob('*') if path.is_file())
            for name in selected:
                if name in contents and not (tree / name).exists():
                    target = tree / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(contents[name])
            # Keep only the sealed inputs reached by this job's actual module graph.
            for folder in ['src', 'lint', 'public']:
                for path in (tree / folder).rglob('*'):
                    if path.is_file() and str(path.relative_to(tree)) not in selected:
                        path.unlink()
        # Imported asset URLs are part of these source guards. Read exact Git
        # objects in one batch; never take the shared working build-copy assets.
        blobs = {os.fsdecode(row.split(b'\t', 1)[1]): row.split(b'\t', 1)[0].split()[2] for row in records}
        assets = set()
        for folder in ['src', 'test']:
            for source in (tree / folder).rglob('*'):
                if specification is not None and str(source.relative_to(tree)) not in executable | set(specification.get('files', [])):
                    continue
                if source.suffix not in {'.ts', '.tsx', '.mts', '.mjs', '.js'}:
                    continue
                for value in re.findall(r"""(?:from\s+|import\s*\(\s*|import\s*)["']([^"']+\.(?:png|jpe?g|webp|svg|hdr|glb|bin|wasm|json)(?:\?[^"']*)?)["']""", source.read_text()):
                    value = value.split('?', 1)[0]
                    name = value[1:] if value.startswith('/src/') else os.path.normpath(str(source.relative_to(tree).parent / value))
                    if name in blobs and not (tree / name).exists():
                        assets.add(name)
        names = sorted(assets)
        raw = git('cat-file', '--batch', input=b''.join(blobs[name] + b'\n' for name in names))
        at = 0
        for name in names:
            end = raw.index(b'\n', at)
            size = int(raw[at:end].split()[2])
            target = tree / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw[end + 1:end + 1 + size])
            at = end + size + 2
        (tree / '.commit-inputs.json').write_text(json.dumps({'testRevision': revision}))


if __name__ == '__main__':
    try:
        staged_source(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), float(sys.argv[3]),
                      None if len(sys.argv) < 5 or sys.argv[4] == '-' else sys.argv[4],
                      json.loads(sys.argv[5]) if len(sys.argv) > 5 else None)
    except (TimeoutError, subprocess.TimeoutExpired) as error:
        print('pre-commit source preparation deferred: ' + str(error), file=sys.stderr)
        raise SystemExit(124)
