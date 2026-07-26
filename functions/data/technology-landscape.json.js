export async function onRequest(context) {
  const { onRequest: handleAnalytics } = await import('../api/analytics.js');
  const res = await handleAnalytics(context);
  if (!res.ok) return res;
  const data = await res.json();
  const points = Object.entries(data.global?.domain_distribution || {}).map(([tag, count], index) => ([
    `pt-${index}`,
    tag,
    'Skin Care',
    'L\'Oreal',
    count
  ]));
  return new Response(JSON.stringify({
    domains: Object.keys(data.global?.domain_distribution || {}),
    points,
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
