"""Use the frozen audit fixture code; no written pack, product or collider config."""
import sys,json,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location('frozen_audit_prepare',ROOT/'docs/reviews/puffer-closed-anatomy-runtime-audit/prepare.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
audit.PATHS['adapted']='art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/closed-anatomy-rig1-native.json'
result=audit.fixture(sys.argv[1])
if sys.argv[1]=='adapted':result['measurement']['candidate']='puffer-closed-anatomy-98c4855852fc / closed-anatomy-rig1; diagnostic only'
print(json.dumps(result))
