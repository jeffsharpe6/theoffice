#!/usr/bin/env python3
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
TVMAZE = Path('/tmp/tvmaze-episodes.json')
RATINGS = Path('/tmp/office_ratings.csv')
LINES = Path('/tmp/the-office-lines/the-office.json')


def norm(value):
    value = value.lower().replace('&', 'and')
    value = re.sub(r'^the\s+', '', value)
    value = re.sub(r'\s*\(?[12]\)?$', '', value)
    value = re.sub(r'[^a-z0-9]+', '', value)
    return value


with TVMAZE.open() as f:
    tvmaze = json.load(f)

# The official 201 count treats the supersized “Goodbye, Michael” as one episode.
tvmaze = [e for e in tvmaze if not (e['season'] == 7 and e['name'] == 'Goodbye, Michael (2)')]

# Close the numbering gap introduced by TVMaze splitting that supersized broadcast.
for e in tvmaze:
    if e['season'] == 7 and e['number'] > 22:
        e['number'] -= 1
    if e['season'] == 7 and e['name'] == 'Goodbye, Michael (1)':
        e['name'] = 'Goodbye, Michael'

ratings = {}
with RATINGS.open(newline='') as f:
    for row in csv.DictReader(f):
        ratings[(int(row['season']), norm(row['title']))] = {
            'rating': float(row['imdb_rating']),
            'votes': int(row['total_votes']),
        }

with LINES.open() as f:
    transcripts = json.load(f)

by_title = {}
for ep in transcripts:
    speakers = Counter()
    all_lines = []
    for scene in ep.get('scenes', []) + ep.get('deleted_scenes', []):
        for line in scene:
            speaker = (line.get('character') or '').strip()
            text = (line.get('line') or '').strip()
            if speaker:
                speakers[speaker] += 1
            if text:
                all_lines.append(text)
    text_blob = ' '.join(all_lines).lower()
    by_title[(int(ep['season']), norm(ep['title']))] = {
        'characters': [name for name, _ in speakers.most_common(12)],
        'twss': len(re.findall(r"that['’]?s what she said", text_blob)),
        'dundies': len(re.findall(r'\bdund(?:ie|y|ies)\b', text_blob)),
        'pranks': len(re.findall(r'\bprank(?:ed|ing|s)?\b', text_blob)),
    }

if (6, norm('Manager and Salesman')) in by_title:
    by_title[(6, norm('The Manager and the Salesman'))] = by_title[(6, norm('Manager and Salesman'))]

# Well-known on-screen Jim/Dwight pranks that dialogue-only matching cannot detect.
PRANK_COUNTS = {
    'Pilot': 2, 'Health Care': 1, 'The Alliance': 2, 'Halloween': 1,
    'Christmas Party': 1, 'Conflict Resolution': 6, 'Gay Witch Hunt': 1,
    'The Coup': 1, 'The Merger': 2, 'Traveling Salesmen': 1, 'Product Recall': 2,
    'Fun Run': 1, 'Dunder Mifflin Infinity': 1, 'Local Ad': 1, 'Branch Wars': 1,
    'Survivor Man': 1, 'Dinner Party': 1, 'Weight Loss': 1, 'Business Ethics': 1,
    'Employee Transfer': 1, 'Customer Survey': 1, 'Stress Relief': 2,
    'Golden Ticket': 1, 'Cafe Disco': 1, 'Gossip': 1, 'Niagara': 1,
    'Murder': 1, 'Koi Pond': 1, 'Viewing Party': 1, 'Classy Christmas': 2,
    'The Seminar': 1, 'The Search': 1, 'Todd Packer': 1, 'Garage Sale': 1,
    'Training Day': 1, 'The List': 1, 'Garden Party': 1, 'Christmas Wishes': 1,
    'Tallahassee': 1, 'Last Day in Florida': 1, 'Work Bus': 1, 'The Target': 1,
    'Dwight Christmas': 1, 'Suit Warehouse': 1, 'Junior Salesman': 1,
    'Vandalism': 1, 'A.A.R.M.': 2, 'Finale': 1,
}

def lookup(mapping, season, title):
    key = (season, norm(title))
    if key in mapping:
        return mapping[key]
    # Match split episodes to their combined-broadcast title.
    stripped = re.sub(r'\s*\([12]\)$', '', title)
    return mapping.get((season, norm(stripped)))


episodes = []
for absolute, ep in enumerate(tvmaze, 1):
    title = ep['name']
    rating_data = lookup(ratings, ep['season'], title)
    transcript = lookup(by_title, ep['season'], title) or {
        'characters': [], 'twss': 0, 'dundies': 0, 'pranks': 0
    }
    clean_title = re.sub(r'\s*\([12]\)$', '', title)
    jokes = {
        'twss': transcript['twss'],
        'dundies': transcript['dundies'],
        'pranks': max(transcript['pranks'], PRANK_COUNTS.get(clean_title, 0)),
    }
    episodes.append({
        'id': f"s{ep['season']:02d}e{ep['number']:02d}",
        'absolute': absolute,
        'season': ep['season'],
        'episode': ep['number'],
        'title': title,
        'airDate': ep['airdate'],
        'rating': rating_data['rating'] if rating_data else ep.get('rating', {}).get('average'),
        'votes': rating_data['votes'] if rating_data else None,
        'summary': re.sub(r'<[^>]+>', '', ep.get('summary') or '').strip(),
        'image': (ep.get('image') or {}).get('original') or (ep.get('image') or {}).get('medium'),
        'characters': transcript['characters'],
        'jokes': jokes,
        'peacock': 'https://www.peacocktv.com/search?q=' + quote_plus(f"The Office {clean_title}"),
    })

assert len(episodes) == 201, len(episodes)
assert all(e['rating'] is not None for e in episodes)

out = ROOT / 'data' / 'episodes.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(episodes, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Wrote {len(episodes)} episodes to {out}')
