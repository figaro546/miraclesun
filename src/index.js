export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL('/404.html', request.url), request));
  },
};

async function handleApi(request, env, url) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  switch (url.pathname) {
    case '/api/track':
      return handleTrack(request, env);
    case '/api/submit':
      return handleSubmit(request, env);
    default:
      return json({ success: false, error: 'Not found' }, 404);
  }
}

async function handleTrack(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (err) {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const type = body.type || 'page_view';
  const path = body.path || null;
  const referrer = body.referrer || null;
  const metadata = JSON.stringify(body.metadata || {});
  const userAgent = request.headers.get('User-Agent') || null;
  const ip = request.headers.get('CF-Connecting-IP') || null;
  const host = new URL(request.url).host;

  await env.DB.prepare(
    `INSERT INTO events (type, host, path, referrer, user_agent, ip, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(type, host, path, referrer, userAgent, ip, metadata)
    .run();

  return json({ success: true });
}

async function handleSubmit(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (err) {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const payload = {
    firstName: body.firstName || null,
    lastName: body.lastName || null,
    email: body.email || null,
    phone: body.phone || null,
    message: body.message || null,
  };

  const metadata = JSON.stringify(payload);
  const userAgent = request.headers.get('User-Agent') || null;
  const ip = request.headers.get('CF-Connecting-IP') || null;
  const host = new URL(request.url).host;

  await env.DB.prepare(
    `INSERT INTO events (type, host, path, referrer, user_agent, ip, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind('contact_submit', host, '/api/submit', null, userAgent, ip, metadata)
    .run();

  return json({ success: true });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
