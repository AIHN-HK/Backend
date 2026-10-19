"""Rebuild the checked-in O*NET 31.0 subset with stdlib only.
Usage: python3 scripts/build-career-dataset.py /path/to/downloaded/csv
Source hashes must match data/career-manifest.json if it exists.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
files = ['occupation_data', 'career_interest_types', 'essential_skills', 'transferable_skills']
hashes = {name + '.csv': hashlib.sha256((source / (name + '.csv')).read_bytes()).hexdigest() for name in files}
manifest_file = root / 'data/career-manifest.json'
if manifest_file.exists():
    assert hashes == json.loads(manifest_file.read_text())['sourceSha256'], 'Source release changed; review before replacing manifest'
def rows(name):
    return list(csv.DictReader((source / (name + '.csv')).open(encoding='utf-8-sig')))
occupations = {r['O*NET-SOC Code']: r for r in rows('occupation_data')}
profiles = {}
labels = dict(zip(['Realistic','Investigative','Artistic','Social','Enterprising','Conventional'], 'RIASEC'))
for row in rows('career_interest_types'):
    if row['Scale ID'] == 'OI':
        profiles.setdefault(row['O*NET-SOC Code'], {})[labels[row['Element Name']]] = float(row['Data Value'])
skills, ratings = {}, {}
for name in ['essential_skills', 'transferable_skills']:
    for r in rows(name):
        if r['Recommend Suppress'] == 'Y' or r['Not Relevant'] == 'Y':
            continue
        skills[r['Element ID']] = r['Element Name']
        ratings.setdefault(r['O*NET-SOC Code'], {}).setdefault(r['Element ID'], {})[r['Scale ID']] = float(r['Data Value'])
careers = []
for code, interest in sorted(profiles.items()):
    assert len(interest) == 6 and all(1 <= n <= 7 for n in interest.values())
    requirements = [{'skillId': key, 'importance': value['IM'], 'level': round(value['LV'] / 7 * 5, 4)} for key, value in ratings.get(code, {}).items() if 'IM' in value and 'LV' in value and value['IM'] > 0]
    requirements.sort(key=lambda r: (-r['importance'], r['skillId']))
    job = occupations[code]
    careers.append({'id': code, 'title': job['Title'], 'description': job['Description'], 'riasec': interest, 'sourceVersion': 'O*NET 31.0', 'sourceUrl': 'https://www.onetonline.org/link/summary/' + code, 'skills': requirements[:8]})
data = {'version': 'O*NET 31.0', 'skills': [{'id': k, 'name': v} for k,v in sorted(skills.items())], 'careers': careers}
content = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
(root / 'data/career-dataset.json').write_bytes(content)
manifest_file.write_text(json.dumps({'version': data['version'], 'source': 'https://www.onetcenter.org/database.html', 'license': 'https://creativecommons.org/licenses/by/4.0/', 'attribution': 'O*NET 31.0 Database, U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). O*NET is a trademark of USDOL/ETA.', 'changes': 'AIHN retains occupations with six OI dimensions; joins descriptions and at most eight highest-importance nonsuppressed skills; converts LV 0..7 to 0..5. Titles/descriptions retained in English. No VN salary/admissions claims. USDOL/ETA has not endorsed or tested these changes.', 'sourceSha256': hashes, 'datasetSha256': hashlib.sha256(content).hexdigest(), 'careers': len(careers), 'skills': len(skills)}, indent=2) + '\n')
print(f'Built {len(careers)} sourced careers and {len(skills)} skills')
