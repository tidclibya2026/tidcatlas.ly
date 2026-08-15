import json, shutil
from pathlib import Path

ROOT = Path('/home/ubuntu/libya-tourism-atlas-app')
SOURCE = ROOT / 'docs/source-imports/2026-08-14/user-requested'
ARCHIVE = Path('/home/ubuntu/webdev-static-assets/libya-tourism-atlas-source-archive-2026-08-14')
ARCHIVE.mkdir(parents=True, exist_ok=True)
manifest_path = ROOT / 'docs/user-requested-sources-manifest-2026-08-14.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
archived = []
for entry in manifest['files']:
    path = SOURCE / entry['storedFileName']
    if path.exists() and path.stat().st_size > 1_000_000:
        target = ARCHIVE / path.name
        shutil.copy2(path, target)
        path.unlink()
        entry['archivedOutsideCheckpoint'] = True
        entry['archivePath'] = str(target)
        archived.append({'originalFileName': entry['originalFileName'], 'archivePath': str(target), 'sizeBytes': target.stat().st_size})
manifest['largeFilePolicy'] = 'Files larger than 1 MB are preserved in the external project asset archive and should be uploaded through Management UI File Storage before publishing.'
manifest['archivedLargeFiles'] = archived
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'archived': archived}, ensure_ascii=False))
