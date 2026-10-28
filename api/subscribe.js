/* POST /api/subscribe — newsletter signup, server side.

   This exists so the beehiiv API key never reaches a browser. The page
   posts here, this calls beehiiv, and the page is told only whether it
   worked. Both values come from the environment and must never be written
   into a file: BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID are set in
   Vercel for Production and Preview.

   The one rule this endpoint exists to keep: {ok:true} is returned ONLY
   when beehiiv has confirmed the subscription. The thing it replaced
   posted with mode:'no-cors', could not see its own result, and told every
   visitor "You're in" regardless. Anything short of a 2xx from beehiiv is
   a failure here, and the caller is expected to say so.

   Plain Node, no framework: Vercel hands this an IncomingMessage and a
   ServerResponse and nothing else. */

const BEEHIIV_API = 'https://api.beehiiv.com/v2/publications';

// Long enough for real addresses, short enough that nobody can post a
// novel at the endpoint. The RFC maximum for an address is 254.
const MAX_EMAIL = 254;
const MAX_BODY = 8 * 1024;
const TIMEOUT_MS = 10000;

/* Deliberately not an RFC-complete grammar — that cannot be done with a
   regular expression, and trying produces something unreadable that still
   rejects valid addresses. This rejects what is obviously not an address
   and leaves the real check to beehiiv, which has to do it anyway. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // A signup result is per-visitor and must never sit in a shared cache
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  // Vercel parses JSON bodies itself, but this must not depend on that
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve(null); }
  }
  return new Promise(function (resolve) {
    var raw = '';
    var done = false;
    req.on('data', function (chunk) {
      if (done) return;
      raw += chunk;
      if (raw.length > MAX_BODY) { done = true; resolve(null); req.destroy(); }
    });
    req.on('end', function () {
      if (done) return;
      done = true;
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve(null); }
    });
    req.on('error', function () { if (!done) { done = true; resolve(null); } });
  });
}

// Only pass a field on if it has something in it. beehiiv rejects some
// fields outright when they are present but empty.
function clean(value, max) {
  if (typeof value !== 'string') return '';
  var v = value.trim();
  if (!v) return '';
  return v.length > max ? v.slice(0, max) : v;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  var key = process.env.BEEHIIV_API_KEY;
  var publication = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !publication) {
    // Logged for the deployment's own logs; the caller is told nothing
    // about which half of the configuration is missing.
    console.error('[subscribe] BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID is not set');
    return send(res, 500, { ok: false, error: 'not_configured' });
  }

  var body = await readBody(req);
  if (!body || typeof body !== 'object') {
    return send(res, 400, { ok: false, error: 'bad_request' });
  }

  /* Honeypot. The field is off-screen and hidden from the accessibility
     tree, so a person never fills it and a bot filling every input does.
     Refused rather than quietly accepted, because this endpoint answers
     {ok:true} only for a confirmed subscription and a dropped bot is not
     one. */
  if (clean(body.botcheck, 64)) {
    return send(res, 400, { ok: false, error: 'rejected' });
  }

  var email = clean(body.email, MAX_EMAIL);
  if (!email || !EMAIL_RE.test(email)) {
    return send(res, 400, { ok: false, error: 'invalid_email' });
  }

  var payload = {
    email: email,
    reactivate_existing: true,
    send_welcome_email: true
  };

  var utmSource = clean(body.utm_source, 120);
  var utmMedium = clean(body.utm_medium, 120);
  var utmCampaign = clean(body.utm_campaign, 120);
  var referring = clean(body.referring_site, 500);
  if (utmSource) payload.utm_source = utmSource;
  if (utmMedium) payload.utm_medium = utmMedium;
  if (utmCampaign) payload.utm_campaign = utmCampaign;
  if (referring) payload.referring_site = referring;

  // beehiiv takes anything beyond its own columns as a custom field, and
  // the field has to exist on the publication first or the call is
  // refused. Only sent when the form actually collected a name.
  var firstName = clean(body.first_name, 80);
  if (firstName) {
    payload.custom_fields = [{ name: 'first_name', value: firstName }];
  }

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

  try {
    var upstream = await fetch(
      BEEHIIV_API + '/' + encodeURIComponent(publication) + '/subscriptions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    if (!upstream.ok) {
      /* Read it for the log and throw the rest away. beehiiv's errors can
         name the publication and quote the request back, and none of that
         belongs in a response a browser can read. */
      var detail = await upstream.text().catch(function () { return ''; });
      console.error('[subscribe] beehiiv ' + upstream.status + ': ' + detail.slice(0, 500));
      return send(res, 502, { ok: false, error: 'upstream_failed' });
    }

    return send(res, 200, { ok: true });
  } catch (err) {
    var reason = err && err.name === 'AbortError' ? 'timeout' : 'network';
    console.error('[subscribe] ' + reason + ': ' + (err && err.message));
    return send(res, 504, { ok: false, error: reason });
  } finally {
    clearTimeout(timer);
  }
};
