import base64
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

API = 'https://bg3.game-script.com/api/graphql'
OUT = Path(__file__).resolve().parents[1] / 'data' / 'dialogue-metadata-cache.json'
MANIFEST = Path(__file__).resolve().parents[1] / 'data' / 'dialogue-metadata-files.json'
QUERY = '''query Q($filename:String!){fileByFilename(filename:$filename){nodes{id textContent constructor nextNodes{id} speaker{displayName name internalName}}}}'''

def request_json(body, timeout=90):
    for attempt in range(6):
        try:
            req = Request(API, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            with urlopen(req, timeout=timeout) as response:
                return json.load(response)
        except Exception:
            if attempt == 5:
                raise
            time.sleep(3 * (attempt + 1))


def gql_batch(filenames):
    aliases = []
    for index, filename in enumerate(filenames):
        escaped = json.dumps(filename)
        aliases.append(f'f{index}:fileByFilename(filename:{escaped}){{nodes{{id textContent constructor nextNodes{{id}} speaker{{displayName name internalName}}}}}}')
    query = 'query {' + ' '.join(aliases) + '}'
    body = json.dumps({'query': query}).encode()
    for attempt in range(5):
        try:
            payload = request_json({'query': query}, timeout=45)
            if payload.get('errors'):
                raise RuntimeError(payload['errors'])
            return payload.get('data', {})
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))


def sync_cache_only(filenames):
    cache = json.loads(OUT.read_text()) if OUT.exists() else {}
    pending = sorted(filenames - cache.keys())
    print(f'cache-only pending={len(pending)}', flush=True)
    batches = [pending[index:index + 10] for index in range(0, len(pending), 10)]
    for index, batch in enumerate(batches, 1):
        try:
            result = gql_batch(batch)
            for offset, filename in enumerate(batch):
                cache[filename] = result.get(f'f{offset}', {}).get('nodes', []) or []
            OUT.write_text(json.dumps(cache, ensure_ascii=False, separators=(',', ':')))
            print(f'progress={index}/{len(batches)} cached={len(cache)}', flush=True)
        except Exception as error:
            print(f'FAILED {batch[0]}..{batch[-1]}: {error}', file=sys.stderr, flush=True)
    OUT.write_text(json.dumps(cache, ensure_ascii=False, separators=(',', ':')))

def main():
    filenames = set(json.loads(MANIFEST.read_text())) if MANIFEST.exists() else set()
    if os.environ.get('DIALOGUE_CACHE_ONLY'):
        sync_cache_only(filenames)
        return
    for act in (1, 2, 3):
        query = f'query {{ filesInAct(act:{act}) {{ filename }} }}'
        try:
            payload = request_json({'query': query})
            filenames.update(row['filename'] for row in payload['data']['filesInAct'])
            MANIFEST.parent.mkdir(parents=True, exist_ok=True)
            MANIFEST.write_text(json.dumps(sorted(filenames), ensure_ascii=False))
        except Exception as error:
            print(f'Could not refresh act {act} file list: {error}', file=sys.stderr, flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    cache = {}
    if OUT.exists():
        cache = json.loads(OUT.read_text())
    pending = sorted(filenames - cache.keys())
    print(f'files={len(filenames)} cached={len(cache)} pending={len(pending)}', flush=True)

    batches = [pending[index:index + 20] for index in range(0, len(pending), 20)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(gql_batch, batch): batch for batch in batches}
        for index, future in enumerate(as_completed(futures), 1):
            batch = futures[future]
            try:
                result = future.result()
                for offset, filename in enumerate(batch):
                    cache[filename] = result.get(f'f{offset}', {}).get('nodes', []) or []
            except Exception as error:
                print(f'FAILED BATCH {batch[0]}..{batch[-1]}: {error}', file=sys.stderr, flush=True)
            if index % 5 == 0 or index == len(batches):
                OUT.write_text(json.dumps(cache, ensure_ascii=False, separators=(',', ':')))
                print(f'progress={index}/{len(batches)} batches cached={len(cache)}', flush=True)

    OUT.write_text(json.dumps(cache, ensure_ascii=False, separators=(',', ':')))
    print(f'written={OUT} files={len(cache)} nodes={sum(len(nodes) for nodes in cache.values())}')


if __name__ == '__main__':
    main()
