#!/usr/bin/env python3
"""Copy AAC packets without encoding and test independent PCM restart identity.

Requires ffprobe/ffmpeg. Temporary ADTS/PCM files are removed on exit. This is
an audio diagnostic, never a shipped bank producer or an admission override.
"""
import argparse
import hashlib
import json
import math
import struct
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path


def command(args):
    return subprocess.check_output(args)


def adts(source, packets):
    result = bytearray()
    for packet in packets:
        offset, size = int(packet['pos']), int(packet['size'])
        length = size + 7
        if length >= 8192 or offset < 0 or offset + size > len(source):
            raise ValueError('Packet cannot be represented by bounded ADTS')
        # AAC-LC, 48 kHz, mono; identical raw access units, no encoder involved.
        result.extend(bytes([255, 241, 76, 64 | (length >> 11),
                             (length >> 3) & 255, ((length & 7) << 5) | 31, 252]))
        result.extend(source[offset:offset + size])
    return result


def compare(expected, actual):
    if len(expected) != len(actual):
        raise ValueError('Decoded sample count changed')
    different, first, last, maximum = 0, None, None, 0
    for i, ((a,), (b,)) in enumerate(zip(struct.iter_unpack('<f', expected),
                                        struct.iter_unpack('<f', actual))):
        if expected[i * 4:i * 4 + 4] != actual[i * 4:i * 4 + 4]:
            different += 1
            first = i if first is None else first
            last = i
            maximum = max(maximum, abs(a - b))
    return {'differentSamples': different, 'first': first, 'last': last,
            'maxAbsoluteError': maximum,
            'expectedSha256': hashlib.sha256(expected).hexdigest(),
            'actualSha256': hashlib.sha256(actual).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('catalogue', type=Path)
    parser.add_argument('--split-packet', type=int, required=True)
    parser.add_argument('--cap-bytes', type=int, default=25_000_000)
    parser.add_argument('--decoders', default='aac,aac_at')
    args = parser.parse_args()
    source = args.source.read_bytes()
    probe = json.loads(command(['ffprobe', '-v', 'error', '-show_streams',
                                '-show_packets', '-of', 'json', str(args.source)]))
    streams, packets = probe['streams'], probe['packets']
    if len(streams) != 1 or streams[0]['profile'] != 'LC' or streams[0]['channels'] != 1 or streams[0]['sample_rate'] != '48000':
        raise ValueError('Diagnostic requires one mono 48 kHz AAC-LC stream')
    if not 0 < args.split_packet < len(packets):
        raise ValueError('Split must be an internal packet boundary')
    if any(p['pts'] != (i - 1) * 1024 for i, p in enumerate(packets)):
        raise ValueError('Unexpected packet timing')
    skip = packets[0]['side_data_list'][0]['skip_samples']
    if skip != 1024:
        raise ValueError('Unexpected priming')
    split = args.split_packet
    boundary = Fraction((split - 1) * 1024, 48000)
    sprite = json.loads(args.catalogue.read_text(), parse_float=Fraction)['sprite']
    cue_mapping = []
    for name, (offset, duration) in sprite['clips'].items():
        offset, duration = Fraction(offset), Fraction(duration)
        if offset < boundary < offset + duration:
            raise ValueError('Split intersects cue: ' + name)
        recording = 0 if offset < boundary else 1
        origin = 0 if recording == 0 else boundary
        local = offset - origin
        if local + origin != offset:
            raise ValueError('Cue offset round trip changed')
        cue_mapping.append({'name': name, 'recording': recording,
                            'offset': str(local), 'duration': str(duration)})
    report = {'sourceSha256': hashlib.sha256(source).hexdigest(),
              'ffmpeg': command(['ffmpeg', '-version']).decode().splitlines()[0],
              'packets': len(packets), 'capBytes': args.cap_bytes,
              'splitPacket': split, 'boundarySeconds': str(boundary),
              'cueOffsetRoundTrips': len(cue_mapping), 'cases': []}
    max_packets = args.cap_bytes // 4096
    warm_max = max_packets - (len(packets) - split)
    warmups = sorted(set([0, 1, 16, warm_max, split]))
    with tempfile.TemporaryDirectory(prefix='aac-split-') as directory:
        root = Path(directory)

        def decode(name, path, decoder):
            out = root / (name + '.f32')
            command(['ffmpeg', '-v', 'error', '-y', '-c:a', decoder, '-i',
                     str(path), '-c:a', 'pcm_f32le', '-f', 'f32le', str(out)])
            return out.read_bytes()

        whole_path = root / 'whole.aac'
        whole_path.write_bytes(adts(source, packets))
        for decoder in args.decoders.split(','):
            original = decode(decoder + '-original', args.source, decoder)
            repeat = decode(decoder + '-repeat', args.source, decoder)
            whole = decode(decoder + '-whole', whole_path, decoder)
            if original != repeat or whole[skip * 4:] != original:
                raise ValueError('Full-file/control decode identity failed: ' + decoder)
            for warm in warmups:
                if not 0 <= warm <= split:
                    continue
                path = root / 'piece.aac'
                path.write_bytes(adts(source, packets[split - warm:]))
                piece = decode(decoder + '-piece', path, decoder)[warm * 4096:]
                expected = whole[split * 4096:]
                result = compare(expected, piece)
                # First recording keeps exactly the original priming/edit.
                joined = original[:(split - 1) * 4096] + piece
                changed_cues = []
                for name, (offset, duration) in sprite['clips'].items():
                    start = math.floor(offset * 48000) * 4
                    end = math.ceil((offset + duration) * 48000) * 4
                    if original[start:end] != joined[start:end]:
                        changed_cues.append(name)
                report['cases'].append({**result, 'decoder': decoder,
                    'warmPackets': warm,
                    'secondDecodedBytes': (len(packets) - split + warm) * 4096,
                    'underCap': (len(packets) - split + warm) * 4096 <= args.cap_bytes,
                    'changedCues': changed_cues})
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
