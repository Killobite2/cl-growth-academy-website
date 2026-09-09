# Generates the FAQPage JSON-LD node for every page that already carries a
# <details> FAQ, from that page's own markup, so the schema and the visible
# answers cannot drift apart.
#
# Run it again after editing any FAQ copy. It replaces the existing FAQPage
# node rather than appending a second one, so it is safe to re-run.
#
# Deliberately not applied to the four article pages under blog/: those write
# their FAQPage by hand because its @id has to sit on the off-domain canonical
# rather than on our own URL.
import io, os, re, json, html

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SITE = 'https://cl-growth-academy-website.vercel.app'

# page -> the #id the FAQ block sits under, for the FAQPage @id
PAGES = {
    'index.html':                        'faq',
    'ndis-marketing/index.html':         'faq',
    'ndis-marketing/seo.html':           'faq',
    'ndis-marketing/ads.html':           'faq',
    'ndis-marketing/email.html':         'faq',
    'ndis-marketing/social.html':        'faq',
    'ndis-marketing/social-ads.html':    'faq',
    'ndis-marketing/managed.html':       'faq',
}

TAGS = re.compile(r'<[^>]+>')
DETAILS = re.compile(r'<details>(.*?)</details>', re.S)
SUMMARY = re.compile(r'<summary>(.*?)</summary>', re.S)
PARA = re.compile(r'<p>(.*?)</p>', re.S)


def text(fragment):
    """Markup to plain text: drop tags, unescape entities, collapse space."""
    s = html.unescape(TAGS.sub('', fragment))
    return re.sub(r'\s+', ' ', s).strip()


def faq_nodes(src):
    out = []
    for block in DETAILS.findall(src):
        q = SUMMARY.search(block)
        if not q:
            continue
        answer = ' '.join(text(p) for p in PARA.findall(block)).strip()
        if not answer:
            continue
        out.append({
            '@type': 'Question',
            'name': text(q.group(1)),
            'acceptedAnswer': {'@type': 'Answer', 'text': answer},
        })
    return out


def dumps(node, indent):
    """json.dumps with every line indented to sit inside the @graph array."""
    pad = ' ' * indent
    body = json.dumps(node, indent=2, ensure_ascii=False)
    return '\n'.join(pad + line for line in body.split('\n')).lstrip()


for path, anchor in PAGES.items():
    src = io.open(path, encoding='utf-8').read()
    questions = faq_nodes(src)
    if not questions:
        print('  %-34s no questions found, skipped' % path)
        continue

    url = SITE + '/' + path.replace(os.sep, '/').replace('index.html', '')
    node = {
        '@type': 'FAQPage',
        '@id': url + '#' + anchor,
        'mainEntity': questions,
    }

    block = re.search(r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>',
                      src, re.S)
    if not block:
        print('  %-34s NO JSON-LD BLOCK, needs one by hand' % path)
        continue

    data = json.loads(block.group(1))

    # A page whose JSON-LD is a single object has to become a @graph before a
    # second node can live alongside it (index.html was the only one).
    if '@graph' not in data:
        data = {'@context': data.pop('@context'), '@graph': [data]}

    data['@graph'] = [n for n in data['@graph'] if n.get('@type') != 'FAQPage']

    # FAQPage goes before BreadcrumbList, so the breadcrumb stays last as it
    # is on every other page.
    idx = next((i for i, n in enumerate(data['@graph'])
                if n.get('@type') == 'BreadcrumbList'), len(data['@graph']))
    data['@graph'].insert(idx, node)

    rendered = json.dumps(data, indent=2, ensure_ascii=False)
    src = src[:block.start(1)] + rendered + src[block.end(1):]
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    print('  %-34s %d questions' % (path, len(questions)))

print('\n  FAQPage schema regenerated')
