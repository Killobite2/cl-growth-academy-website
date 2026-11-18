/* POST /api/subscribe — newsletter and free-resource signup, server side.

   This exists so the beehiiv API key never reaches a browser. The page
   posts here, this calls beehiiv, and the page is told only whether it
   worked. Every secret comes from the environment and must never be
   written into a file:

     BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID   required, Production and Preview
     SLACK_SIGNUP_WEBHOOK_URL                  optional, the owner alert below

   The one rule this endpoint exists to keep: {ok:true} is returned ONLY
   when beehiiv has confirmed the request. The thing it replaced posted
   with mode:'no-cors', could not see its own result, and told every
   visitor "You're in" regardless. Anything short of a 2xx from beehiiv is
   a failure here, and the caller is expected to say so.

   Two kinds of request arrive here.

   1. SIGNUP (has an email). Every signup form on the site. The resource
      forms (the hub, the nine gated resource pages and both forms on
      /newsletter.html) also send `resource`, and for those a first name is
      required. The footer and homepage forms send no `resource` and stay
      email-only. Answers {ok:true, ref} where ref is beehiiv's subscription
      id: the browser keeps it in sessionStorage for /resources/thanks.html
      and never puts it in an address.

   2. PROFILE (has a ref, no email). The two questions on the thanks page.
      Saves role and business_type to the subscription, and when the role
      is Owner posts one message to Slack.

   beehiiv custom fields used here, and they must exist on the publication
   with exactly these names: "First Name", "Last Name", "resource", "role",
   "business_type". A name beehiiv does not know is NOT refused: it drops
   the value, still answers 2xx and lists the problem under `warnings`.
   Those warnings are logged below, because nothing else would show them.

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

// beehiiv's subscription ids: "sub_" and a UUID.
const REF_RE = /^sub_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The `resource` values the forms send. Anything else is refused rather
// than written into beehiiv, so the field stays clean enough to segment on.
const RESOURCES = [
  'resources-hub',
  'growth-audit-checklist',
  'linkedin-referral-outreach-sop',
  'ndis-linkedin-playbook',
  'weekly-meta-ads-report',
  'ndis-marketing-playbook',
  'ndis-event-marketing-playbook',
  'facebook-groups-playbook',
  'ndis-website-checklist',
  'enquiry-response-script',
  'newsletter'
];

// The thanks page's two questions, word for word from its options (R4-18).
const ROLES = ['Owner', 'Executive', 'Marketing', 'Intake or enquiries', 'Other'];
const BUSINESS_TYPES = ['NDIS', 'Aged care', 'Both'];

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

/* One call to beehiiv, with the timeout and the error handling every call
   here needs. Resolves to the parsed JSON body on a 2xx and throws on
   anything else. beehiiv's errors can name the publication and quote the
   request back, so the detail goes to the deployment log and never to the
   browser. */
async function beehiiv(method, path, key, body) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    var upstream = await fetch(BEEHIIV_API + path, {
      method: method,
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    var text = await upstream.text().catch(function () { return ''; });
    if (!upstream.ok) {
      var err = new Error('beehiiv ' + upstream.status + ': ' + text.slice(0, 500));
      err.kind = 'upstream';
      throw err;
    }
    var json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = {}; }
    // An unknown custom field name lands here, not in an error. See the
    // header comment: the value is gone, so say so where Dreau will look.
    if (json && json.warnings && json.warnings.length) {
      console.error('[subscribe] beehiiv warnings on ' + method + ' ' + path.replace(/\/[^/]+\//, '/…/') +
        ': ' + JSON.stringify(json.warnings).slice(0, 500));
    }
    return json;
  } catch (err) {
    if (!err.kind) err.kind = err.name === 'AbortError' ? 'timeout' : 'network';
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function failed(res, err) {
  console.error('[subscribe] ' + err.kind + ': ' + (err && err.message));
  if (err.kind === 'upstream') return send(res, 502, { ok: false, error: 'upstream_failed' });
  return send(res, 504, { ok: false, error: err.kind });
}

function fieldValue(subscription, name) {
  var fields = (subscription && subscription.custom_fields) || [];
  for (var i = 0; i < fields.length; i++) {
    if (fields[i] && fields[i].name === name) return String(fields[i].value == null ? '' : fields[i].value);
  }
  return '';
}

/* The owner alert. Posted only for role Owner, only when the webhook is
   configured, and never allowed to fail the request: the answers are
   already saved in beehiiv by the time this runs, so a Slack outage costs
   one notification, not the visitor's answers. The URL lives in the
   environment only. */
async function alertOwnerSignup(details) {
  var hook = process.env.SLACK_SIGNUP_WEBHOOK_URL;
  if (!hook) return;
  var date = new Date().toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric'
  });
  var text = [
    'New owner sign-up',
    'First name: ' + (details.firstName || '(not given)'),
    'Email: ' + (details.email || '(not found)'),
    'Role: ' + details.role,
    'Business type: ' + (details.businessType || '(not answered)'),
    'Resource: ' + (details.resource || '(not recorded)'),
    'Date: ' + date
  ].join('\n');

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    var r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
      signal: controller.signal
    });
    if (!r.ok) console.error('[subscribe] Slack alert failed: ' + r.status);
  } catch (err) {
    console.error('[subscribe] Slack alert failed: ' + (err && err.message));
  } finally {
    clearTimeout(timer);
  }
}

async function signup(res, body, key, publication) {
  var email = clean(body.email, MAX_EMAIL);
  if (!email || !EMAIL_RE.test(email)) {
    return send(res, 400, { ok: false, error: 'invalid_email' });
  }

  var resource = clean(body.resource, 64);
  if (resource && RESOURCES.indexOf(resource) === -1) {
    return send(res, 400, { ok: false, error: 'bad_request' });
  }

  var firstName = clean(body.first_name, 80);
  var lastName = clean(body.last_name, 80);
  // Required on every form that names a resource. The footer and homepage
  // forms name none and collect no name, and keep working without one.
  if (resource && !firstName) {
    return send(res, 400, { ok: false, error: 'missing_first_name' });
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

  // Each field is sent only when the form actually collected it.
  var customFields = [];
  if (firstName) customFields.push({ name: 'First Name', value: firstName });
  if (lastName) customFields.push({ name: 'Last Name', value: lastName });
  if (resource) customFields.push({ name: 'resource', value: resource });
  if (customFields.length) payload.custom_fields = customFields;

  try {
    var json = await beehiiv('POST', '/' + encodeURIComponent(publication) + '/subscriptions', key, payload);
    var ref = json && json.data && typeof json.data.id === 'string' && REF_RE.test(json.data.id) ? json.data.id : '';
    return send(res, 200, ref ? { ok: true, ref: ref } : { ok: true });
  } catch (err) {
    return failed(res, err);
  }
}

async function profile(res, body, key, publication) {
  var ref = clean(body.ref, 64);
  if (!REF_RE.test(ref)) return send(res, 400, { ok: false, error: 'bad_request' });

  var role = clean(body.role, 40);
  var businessType = clean(body.business_type, 40);
  if (role && ROLES.indexOf(role) === -1) role = '';
  if (businessType && BUSINESS_TYPES.indexOf(businessType) === -1) businessType = '';
  if (!role && !businessType) return send(res, 400, { ok: false, error: 'nothing_to_save' });

  var customFields = [];
  if (role) customFields.push({ name: 'role', value: role });
  if (businessType) customFields.push({ name: 'business_type', value: businessType });

  var path = '/' + encodeURIComponent(publication) + '/subscriptions/' + encodeURIComponent(ref);
  try {
    await beehiiv('PUT', path, key, { custom_fields: customFields });
  } catch (err) {
    return failed(res, err);
  }

  if (role === 'Owner' && !process.env.SLACK_SIGNUP_WEBHOOK_URL) {
    console.warn('[subscribe] SLACK_SIGNUP_WEBHOOK_URL is not set, owner alert skipped');
  } else if (role === 'Owner') {
    // The page only holds the ref, so the name, email and resource come back
    // from beehiiv rather than from anything the browser could have edited.
    var subscription = null;
    try {
      var json = await beehiiv('GET', path + '?expand[]=custom_fields', key);
      subscription = json && json.data;
    } catch (err) {
      console.error('[subscribe] could not read the subscription for the owner alert: ' + err.message);
    }
    await alertOwnerSignup({
      firstName: fieldValue(subscription, 'First Name'),
      email: subscription && subscription.email,
      role: role,
      businessType: businessType,
      resource: fieldValue(subscription, 'resource')
    });
  }

  return send(res, 200, { ok: true });
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

  // A profile update carries the ref and no email; everything else is a
  // signup, and a signup with no email is refused inside signup().
  if (body.ref && !body.email) return profile(res, body, key, publication);
  return signup(res, body, key, publication);
};
