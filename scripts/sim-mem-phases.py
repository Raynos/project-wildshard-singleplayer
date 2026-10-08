#!/usr/bin/env python3
"""sim-mem-phases.py — an iOS Simulator's WebContent native memory, per phase, recorded (never a pass / fail) (E264).

The sampler behind scripts/nine-sim-memory.mjs. It reuses scripts/ios-memory-watchdog.py's kernel reading
(proc_pid_rusage RUSAGE_INFO_V4 physical footprint, every 100 ms) and its interval high-water counter, reset at
each phase start, so a burst between two samples still counts toward the phase it happened in.

The phase is the text in --phase-file, written by the driver. 'done' ends the run.
The summary names the game tab's process: the WebContent PID with the highest interval high.
Its other numbers:
  - the sum over every WebContent process in that Simulator (a ~0.04 GB prewarmed one included);
  - the WebKit GPU process, separately.

  python3 scripts/sim-mem-phases.py --device <udid> --phase-file <f> --out <new .jsonl> [--max 900]
"""
import argparse
import datetime
import importlib.util
import json
import pathlib
import sys
import time

spec = importlib.util.spec_from_file_location('watchdog', pathlib.Path(__file__).with_name('ios-memory-watchdog.py'))
if spec is None or spec.loader is None:
    sys.exit('sim-mem-phases: scripts/ios-memory-watchdog.py not found')
wd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wd)
GB = 1e9


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--device', required=True, help='a booted Simulator UDID (never a physical iPhone)')
    ap.add_argument('--phase-file', type=pathlib.Path, required=True)
    ap.add_argument('--out', type=pathlib.Path, required=True, help='a new JSONL file (refuses to overwrite)')
    ap.add_argument('--interval', type=float, default=0.1)
    ap.add_argument('--max', type=float, default=900, help='seconds before it stops on its own')
    ap.add_argument('--sample-interval-high', action='store_true',
                    help='reset kernel interval highs after each sample; phase summary maxima stay cumulative')
    ap.add_argument('--process-identities', action='store_true',
                    help='include GPU and WebContent PID/start identities for restart diagnostics')
    args = ap.parse_args()

    native = wd.NativeMemory()
    manager = int(wd.command(['xcrun', 'simctl', 'spawn', args.device, 'launchctl', 'managerpid']))
    out = args.out.open('x')

    def emit(kind, **fields):
        out.write(json.dumps({'type': kind, 't': datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields}) + '\n')
        out.flush()

    def phase_now():
        try:
            return args.phase_file.read_text().strip() or 'idle'
        except FileNotFoundError:
            return 'idle'

    peaks = {}
    identities = {}
    lost = []
    phase = None
    start = time.monotonic()

    def bucket(ph):
        return peaks.setdefault(ph, {'samples': 0, 'agg': 0, 'aggInterval': 0, 'pidInterval': {}, 'pidFootprint': {},
                                     'gpuInterval': 0, 'first': None, 'last': None})

    while True:
        tick = time.monotonic()
        ph = phase_now()
        procs = wd.simulator_processes(manager)
        gprocs = wd.simulator_processes(manager, 'com.apple.WebKit.GPU')
        if ph != phase:
            if phase is not None:  # close the old phase with its interval highs as they stand
                b = bucket(phase)
                for pid in procs:
                    try:
                        r = native.sample(pid)
                    except RuntimeError:
                        continue
                    b['pidInterval'][pid] = max(b['pidInterval'].get(pid, 0), r['intervalMaxPhysicalFootprintBytes'], r['physicalFootprintBytes'])
            for pid in list(procs) + list(gprocs):
                try:
                    native.reset_interval(pid)
                except RuntimeError as error:
                    emit('reset-failed', pid=pid, error=str(error))
            emit('phase', phase=ph, elapsed=round(tick - start, 2))
            print(f'[{tick - start:6.1f}s] phase -> {ph}', flush=True)
            phase = ph
            if ph == 'done':
                break
        rows = []
        for pid in sorted(procs):
            try:
                r = native.sample(pid)
            except RuntimeError:
                continue
            rows.append(r)
            if pid in identities and identities[pid] != r['startAbstime']:
                lost.append({'pid': pid, 'phase': ph, 'restarted': True})
            identities[pid] = r['startAbstime']
        for pid in list(identities):
            if pid not in procs and not any(x['pid'] == pid for x in lost):
                lost.append({'pid': pid, 'phase': ph, 'elapsed': round(tick - start, 1)})
                emit('process-gone', pid=pid, phase=ph)
                print(f'[{tick - start:6.1f}s] WebContent {pid} gone during {ph}', flush=True)
        grows = []
        for pid in sorted(gprocs):
            try:
                grows.append(native.sample(pid))
            except RuntimeError:
                pass
        b = bucket(ph)
        el = round(tick - start, 2)
        b['samples'] += 1
        b['first'] = el if b['first'] is None else b['first']
        b['last'] = el
        agg = sum(r['physicalFootprintBytes'] for r in rows)
        agg_interval = sum(max(r['physicalFootprintBytes'], r['intervalMaxPhysicalFootprintBytes']) for r in rows)
        b['agg'] = max(b['agg'], agg)
        b['aggInterval'] = max(b['aggInterval'], agg_interval)
        for r in rows:
            p = r['pid']
            b['pidFootprint'][p] = max(b['pidFootprint'].get(p, 0), r['physicalFootprintBytes'])
            b['pidInterval'][p] = max(b['pidInterval'].get(p, 0), r['intervalMaxPhysicalFootprintBytes'], r['physicalFootprintBytes'])
        b['gpuInterval'] = max(b['gpuInterval'], sum(max(r['physicalFootprintBytes'], r['intervalMaxPhysicalFootprintBytes']) for r in grows))
        detail = {}
        if args.process_identities:
            detail = {'processIdentities': {
                kind: {r['pid']: {'startAbstime': r['startAbstime'],
                                 'footprintBytes': r['physicalFootprintBytes'],
                                 'intervalMaxBytes': r['intervalMaxPhysicalFootprintBytes']} for r in entries}
                for kind, entries in (('webContent', rows), ('gpu', grows))}}
        emit('sample', phase=ph, elapsed=el, footprint=agg, interval=agg_interval,
             pids={r['pid']: [r['physicalFootprintBytes'], r['intervalMaxPhysicalFootprintBytes']] for r in rows},
             gpu=sum(r['physicalFootprintBytes'] for r in grows), **detail)
        if args.sample_interval_high:
            for pid in list(procs) + list(gprocs):
                try:
                    native.reset_interval(pid)
                except RuntimeError as error:
                    emit('reset-failed', pid=pid, error=str(error))
        if tick - start > args.max:
            print('sim-mem-phases: --max reached', flush=True)
            break
        time.sleep(max(0, args.interval - (time.monotonic() - tick)))

    summary = {}
    for ph, b in peaks.items():
        game, high = max(b['pidInterval'].items(), key=lambda kv: kv[1], default=(None, 0))
        summary[ph] = {
            'samples': b['samples'], 'seconds': round((b['last'] or 0) - (b['first'] or 0), 1),
            'gamePid': game, 'gameHighGB': round(high / GB, 3),
            'gameSampledGB': round(b['pidFootprint'].get(game, 0) / GB, 3) if game is not None else 0,
            'allWebContentGB': round(b['aggInterval'] / GB, 3), 'gpuProcessGB': round(b['gpuInterval'] / GB, 3),
        }
    emit('summary', phases=summary, lost=lost)
    print(json.dumps({'phases': summary, 'lost': lost}), flush=True)
    out.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
