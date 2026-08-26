import json, base64, sys
src, out = sys.argv[1], sys.argv[2]
with open(src) as f:
    data = json.load(f)
text = data[0]['text'].strip()
if text.startswith('"'):
    text = json.loads(text)
prefix = 'data:image/png;base64,'
assert text.startswith(prefix), text[:50]
b64 = text[len(prefix):]
with open(out, 'wb') as o:
    o.write(base64.b64decode(b64))
print('wrote', out)
