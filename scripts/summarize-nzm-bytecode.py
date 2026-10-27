"""Compatibility entry for the NZM Toolkit bytecode display helper."""
import json
import os
from pathlib import Path
import runpy
import subprocess

root = os.environ.get('NZM_TOOLKIT_ROOT')
if not root:
    skill = Path.home() / '.agents/skills/nzm-assets'
    if skill.exists():
        root = str(skill.resolve().parents[1])
if not root or not (Path(root) / 'runtime/BUILDINFO.json').is_file():
    raise SystemExit('Install lostlightll/nzm-toolkit; see docs/workflows/nzm-toolkit.md')
lock = Path(__file__).resolve().parents[1] / 'nzm-toolkit.json'
if lock.exists():
    revision = subprocess.check_output(['git', '-C', root, 'rev-parse', 'HEAD'], text=True).strip()
    if revision != json.loads(lock.read_text(encoding='utf-8'))['revision']:
        raise SystemExit('NZM Toolkit revision differs from nzm-toolkit.json')
runpy.run_path(str(Path(root) / 'tools/summarize-nzm-bytecode.py'), run_name='__main__')
