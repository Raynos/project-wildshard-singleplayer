#!/usr/bin/env python3
"""E261: fail a Simulator WebContent run above a native memory budget. macOS only."""
import argparse
import ctypes
import datetime
import json
import math
import pathlib
import subprocess
import sys
import time

GIB = 1024 ** 3


class RUsageInfo(ctypes.Structure):
    # macOS SDK sys/resource.h, rusage_info_v0. Do not substitute JS heap size.
    _fields_ = [('uuid', ctypes.c_ubyte * 16)] + [
        (name, ctypes.c_uint64) for name in (
            'user_time', 'system_time', 'pkg_idle_wkups', 'interrupt_wkups',
            'pageins', 'wired_size', 'resident_size', 'phys_footprint',
            'proc_start_abstime', 'proc_exit_abstime')]


class NativeMemory:
    def __init__(self):
        if sys.platform != 'darwin':
            raise RuntimeError('Native memory sampling requires macOS, not an iOS JS heap API')
        self.lib = ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
        self.lib.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
        self.lib.proc_pid_rusage.restype = ctypes.c_int

    def sample(self, pid):
        usage = RUsageInfo()
        if self.lib.proc_pid_rusage(pid, 0, ctypes.byref(usage)) != 0:
            raise RuntimeError(f'Cannot read PID {pid}: errno {ctypes.get_errno()} (exit or access failure)')
        if not usage.proc_start_abstime or usage.proc_exit_abstime:
            raise RuntimeError(f'PID {pid} has exited or has no valid start identity')
        return {
            'pid': pid, 'startAbstime': usage.proc_start_abstime,
            'physicalFootprintBytes': usage.phys_footprint,
            'residentBytes': usage.resident_size,
        }


def command(args):
    result = subprocess.run(args, check=True, capture_output=True, text=True, timeout=10)
    return result.stdout.strip()


def simulator_processes(manager_pid):
    # All WebContent processes under this Simulator's launchd, including prewarmed
    # processes. Avoid desktop Safari and every other booted Simulator.
    rows = {}
    for line in command(['/bin/ps', '-axo', 'pid=,ppid=,comm=']).splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) == 3:
            rows[int(parts[0])] = (int(parts[1]), parts[2])
    selected = {}
    for pid, (_, path) in rows.items():
        if pathlib.PurePath(path).name != 'com.apple.WebKit.WebContent':
            continue
        ancestor = pid
        visited = set()
        while ancestor in rows and ancestor not in visited:
            visited.add(ancestor)
            ancestor = rows[ancestor][0]
            if ancestor == manager_pid:
                selected[pid] = path
                break
    return selected


class BudgetRun:
    def __init__(self, budget_bytes):
        self.budget_bytes = budget_bytes
        self.identities = {}
        self.peak_footprint = 0
        self.peak_resident = 0
        self.samples = 0

    def observe(self, readings):
        current = {row['pid']: row['startAbstime'] for row in readings}
        for pid, started in self.identities.items():
            if current.get(pid) != started:
                return f'WebContent process disappeared or restarted: PID {pid}'
        self.identities.update(current)
        footprint = sum(row['physicalFootprintBytes'] for row in readings)
        resident = sum(row['residentBytes'] for row in readings)
        self.peak_footprint = max(self.peak_footprint, footprint)
        self.peak_resident = max(self.peak_resident, resident)
        if readings:
            self.samples += 1
        if footprint > self.budget_bytes:
            return f'Physical footprint {footprint / GIB:.3f} GiB exceeds {self.budget_bytes / GIB:.3f} GiB budget'
        return None


def positive_number(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError('must be a finite positive number')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True, help='Booted Simulator UDID (never a physical iPhone)')
    parser.add_argument('--budget-gib', type=positive_number, default=4, help='Aggregate WebContent physical footprint, default 4 GiB')
    parser.add_argument('--duration', type=positive_number, default=120, help='Seconds to watch AFTER first WebContent sample')
    parser.add_argument('--interval', type=positive_number, default=0.25, help='Sampling interval in seconds; default 0.25')
    parser.add_argument('--start-timeout', type=positive_number, default=30, help='Fail if no WebContent appears within this many seconds')
    parser.add_argument('--pid', type=int, help='Optional single WebContent PID, validated as belonging to this Simulator')
    parser.add_argument('--url', help='Optionally open this URL in Simulator Safari after the watchdog starts')
    parser.add_argument('--out', type=pathlib.Path, required=True, help='New JSONL output path (refuses to overwrite)')
    args = parser.parse_args()
    run = BudgetRun(int(args.budget_gib * GIB))
    started = time.monotonic()
    attached = None
    result = 'error'
    reason = 'No samples recorded'
    code = 2
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('x') as output:
        def emit(kind, **fields):
            row = {'type': kind, 'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields}
            output.write(json.dumps(row) + '\n')
            output.flush()
        try:
            native = NativeMemory()
            manager = int(command(['xcrun', 'simctl', 'spawn', args.device, 'launchctl', 'managerpid']))
            manager_identity = native.sample(manager)['startAbstime']
            emit('start', device=args.device, simulatorLaunchdPid=manager,
                 simulatorLaunchdStartAbstime=manager_identity, budgetBytes=run.budget_bytes,
                 durationSeconds=args.duration, intervalSeconds=args.interval,
                 scope='single Simulator WebContent PID' if args.pid else 'sum of all Simulator WebContent processes',
                 metric='macOS proc_pid_rusage RUSAGE_INFO_V0 ri_phys_footprint', url=args.url)
            print(f'Watching Simulator {args.device}; {args.budget_gib:g} GiB native footprint budget', flush=True)
            if args.url:
                command(['xcrun', 'simctl', 'openurl', args.device, args.url])
            while True:
                tick = time.monotonic()
                if native.sample(manager)['startAbstime'] != manager_identity:
                    raise RuntimeError('Simulator launchd restarted; monitoring continuity lost')
                processes = simulator_processes(manager)
                if args.pid:
                    processes = {pid: path for pid, path in processes.items() if pid == args.pid}
                readings = [{**native.sample(pid), 'executable': path} for pid, path in sorted(processes.items())]
                failure = run.observe(readings)
                emit('sample', elapsedSeconds=round(time.monotonic() - started, 3), processes=readings,
                     physicalFootprintBytes=sum(row['physicalFootprintBytes'] for row in readings),
                     residentBytes=sum(row['residentBytes'] for row in readings))
                if failure:
                    result, reason, code = 'fail', failure, 1
                    break
                now = time.monotonic()
                if readings and attached is None:
                    attached = now
                    print('Attached to PID(s): ' + ', '.join(str(row['pid']) for row in readings), flush=True)
                if attached is None and now - started >= args.start_timeout:
                    raise RuntimeError('No matching Simulator WebContent process; refusing an empty pass')
                if attached is not None and now - attached >= args.duration:
                    result, reason, code = 'pass', 'Observed native memory stayed within budget for the requested window', 0
                    break
                time.sleep(max(0, args.interval - (time.monotonic() - tick)))
        except KeyboardInterrupt:
            result, reason, code = 'interrupted', 'Run interrupted before completion; not a pass', 130
        except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as error:
            result, reason, code = 'error', str(error), 2
        emit('result', result=result, reason=reason, exitCode=code, samples=run.samples,
             elapsedSeconds=round(time.monotonic() - started, 3),
             peakPhysicalFootprintBytes=run.peak_footprint, peakResidentBytes=run.peak_resident,
             processIdentities=run.identities)
        print(f'{result.upper()}: {reason}; peak footprint {run.peak_footprint / GIB:.3f} GiB; report {args.out}', flush=True)
    return code


if __name__ == '__main__':
    sys.exit(main())
