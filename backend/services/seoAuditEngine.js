// backend/services/seoAuditEngine.js
// SEO audit engine — fetches a URL and runs 25+ checks

const axios = require('axios');

const UA = 'RauljiCRM-SEO-Bot/1.0';

// ── HTML helpers ──────────────────────────────────────────────────────────────

function extract(html, pattern) {
  const m = html.match(pattern);
  return m ? (m[1] || '').trim() : null;
}

function getTitle(html)   { return extract(html, /<title[^>]*>([\s\S]*?)<\/title>/i); }
function getH1(html)      { return extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i); }
function getLang(html)    { return extract(html, /<html[^>]+lang=["']([^"']*)["']/i); }
function getCharset(html) { return extract(html, /<meta[^>]+charset=["']([^"']*)["']/i) || extract(html, /<meta[^>]*charset=([^\s"'/>]+)/i); }

function getMeta(html, name) {
  return extract(html, new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || extract(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
}

function getOG(html, prop) {
  return extract(html, new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || extract(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, 'i'));
}

function countTags(html, tag) {
  return (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(html) {
  return stripTags(html).split(/\s+/).filter(w => w.length > 2).length;
}

function getImagesMissingAlt(html) {
  const imgs = html.match(/<img[^>]*>/gi) || [];
  return imgs.filter(i => !/alt=["'][^"']+["']/.test(i)).length;
}

function getCanonical(html) {
  return extract(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
    || extract(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
}

function hasViewport(html) { return /<meta[^>]+name=["']viewport["']/i.test(html); }
function hasRobotsMeta(html) { return getMeta(html, 'robots'); }
function hasStructuredData(html) { return /<script[^>]+type=["']application\/ld\+json["']/i.test(html); }
function hasTwitterCard(html) { return !!getMeta(html, 'twitter:card'); }

function getInternalLinks(html, domain) {
  const links = html.match(/href=["']([^"'#?]+)["']/gi) || [];
  return links.filter(l => l.includes(domain) || /href=["']\//.test(l)).length;
}

function getExternalLinks(html, domain) {
  const links = html.match(/href=["'](https?:\/\/[^"']+)["']/gi) || [];
  return links.filter(l => !l.includes(domain)).length;
}

function hasCTA(html) {
  const text = stripTags(html).toLowerCase();
  return /\b(buy now|sign up|get started|contact us|free trial|request demo|book now|call us|register|subscribe|get quote)\b/.test(text);
}

function hasHreflang(html) { return /rel=["']alternate["'][^>]+hreflang/i.test(html) || /hreflang=["'][^"']+["']/i.test(html); }

// ── Check a single URL (for URL checker feature) ──────────────────────────────

exports.checkUrl = async (url) => {
  const start = Date.now();
  try {
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': UA },
      maxRedirects: 10,
      validateStatus: () => true,
    });
    return {
      url,
      status: resp.status,
      ok: resp.status >= 200 && resp.status < 400,
      redirected: resp.request?.res?.responseUrl !== url,
      finalUrl: resp.request?.res?.responseUrl || url,
      responseTime: Date.now() - start,
      contentType: resp.headers['content-type'] || '',
    };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message, responseTime: Date.now() - start };
  }
};

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchPage(url) {
  const start = Date.now();
  try {
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
      validateStatus: () => true,
    });
    return {
      html: typeof resp.data === 'string' ? resp.data : '',
      status: resp.status,
      headers: resp.headers,
      finalUrl: resp.request?.res?.responseUrl || url,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return { html: '', status: 0, headers: {}, finalUrl: url, responseTime: Date.now() - start, error: err.message };
  }
}

async function checkResource(url, path) {
  try {
    const base = url.replace(/\/$/, '');
    const resp = await axios.head(`${base}${path}`, { timeout: 8000, validateStatus: () => true, headers: { 'User-Agent': UA } });
    return resp.status >= 200 && resp.status < 400;
  } catch { return false; }
}

// ── Main audit function ───────────────────────────────────────────────────────

exports.runAudit = async (domain, keywords = []) => {
  // Normalise URL
  let url = domain.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const page = await fetchPage(url);
  const html = page.html || '';
  const domainHost = url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

  // Parallel resource checks
  const [hasSitemap, hasRobots] = await Promise.all([
    checkResource(url, '/sitemap.xml'),
    checkResource(url, '/robots.txt'),
  ]);

  // Extract page data
  const title        = getTitle(html) || '';
  const metaDesc     = getMeta(html, 'description') || '';
  const h1           = getH1(html) || '';
  const canonical    = getCanonical(html) || '';
  const robotsMeta   = getMeta(html, 'robots') || '';
  const lang         = getLang(html) || '';
  const charset      = getCharset(html) || '';
  const ogTitle      = getOG(html, 'title') || '';
  const ogDesc       = getOG(html, 'description') || '';
  const ogImage      = getOG(html, 'image') || '';
  const h1Count      = countTags(html, 'h1');
  const h2Count      = countTags(html, 'h2');
  const imgMissingAlt= getImagesMissingAlt(html);
  const imgTotal     = countTags(html, 'img');
  const wordCount    = countWords(html);
  const internalLinks= getInternalLinks(html, domainHost);
  const externalLinks= getExternalLinks(html, domainHost);
  const isHttps      = url.startsWith('https://');
  const titleLen     = title.length;
  const metaDescLen  = metaDesc.length;

  // ── Build issues ──────────────────────────────────────────────────────────

  const issues = [];

  const add = (id, severity, category, title_, desc, fix, passed) =>
    issues.push({ id, severity, category, title: title_, description: desc, fix, passed });

  // Technical checks
  if (page.error || page.status === 0) {
    add('fetch_failed', 'critical', 'Technical', 'Page could not be fetched',
      `Could not reach ${url}: ${page.error || 'No response'}`,
      'Ensure the website is live and accessible. Check DNS, hosting, and firewall settings.',
      false);
  }

  add('https', isHttps ? 'passed' : 'critical', 'Technical', 'HTTPS (SSL) enabled',
    isHttps ? 'Site uses HTTPS — good for security and SEO.'
            : 'Site is using HTTP. Google penalises non-HTTPS sites.',
    'Install an SSL certificate (free via Let\'s Encrypt) and redirect all HTTP traffic to HTTPS.',
    isHttps);

  const respOk = page.responseTime <= 2000;
  add('response_time', respOk ? 'passed' : 'warning', 'Technical', 'Server response time',
    `Response time: ${page.responseTime}ms (target: <2000ms)`,
    'Optimise server configuration, enable caching, use a CDN, and reduce Time-To-First-Byte (TTFB).',
    respOk);

  add('robots_txt', hasSitemap || hasRobots ? 'passed' : 'warning', 'Technical', 'robots.txt accessible',
    hasRobots ? 'robots.txt found — search bots can read crawl rules.'
              : 'robots.txt not found. Without it, crawlers cannot read your crawl instructions.',
    'Create a /robots.txt file. At minimum: "User-agent: *\\nAllow: /"  and add Sitemap: https://yourdomain.com/sitemap.xml',
    hasRobots);

  add('sitemap', hasSitemap ? 'passed' : 'warning', 'Technical', 'XML Sitemap accessible',
    hasSitemap ? 'sitemap.xml found — helps search engines discover all pages.'
               : 'sitemap.xml not found at /sitemap.xml.',
    'Generate an XML sitemap and submit it to Google Search Console. Most CMS platforms (WordPress, Next.js) have sitemap plugins.',
    hasSitemap);

  const viewportOk = hasViewport(html);
  add('viewport', viewportOk ? 'passed' : 'critical', 'Technical', 'Mobile viewport meta tag',
    viewportOk ? 'Viewport meta tag found — page is mobile-friendly.'
               : 'No viewport meta tag found. Page will not render correctly on mobile devices.',
    'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head>.',
    viewportOk);

  const charsetOk = !!charset;
  add('charset', charsetOk ? 'passed' : 'info', 'Technical', 'Charset declared',
    charsetOk ? `Charset declared: ${charset}` : 'No charset meta tag found.',
    'Add <meta charset="UTF-8"> as the first tag inside <head>.',
    charsetOk);

  const langOk = !!lang;
  add('html_lang', langOk ? 'passed' : 'info', 'Technical', 'HTML lang attribute',
    langOk ? `HTML lang="${lang}" — helps screen readers and search engines identify language.`
           : 'No lang attribute on <html> tag.',
    `Add lang attribute to your HTML tag: <html lang="en"> (or your target language, e.g. "hi" for Hindi, "en-IN" for Indian English).`,
    langOk);

  // Indexing
  const isNoindex = robotsMeta.toLowerCase().includes('noindex');
  add('robots_meta', !isNoindex ? 'passed' : 'critical', 'Technical', 'Page is indexable',
    isNoindex ? 'robots meta tag contains "noindex" — this page is blocked from search engines!'
              : robotsMeta ? `Robots meta: "${robotsMeta}" — page is indexable.` : 'No robots meta tag — page is indexable by default.',
    'Remove "noindex" from the robots meta tag, or remove the tag entirely if you want this page indexed.',
    !isNoindex);

  // On-Page
  const titleExists = title.length > 0;
  const titleGood = titleLen >= 30 && titleLen <= 60;
  add('title_exists', titleExists ? (titleGood ? 'passed' : 'warning') : 'critical', 'On-Page', 'Title tag',
    titleExists
      ? `Title: "${title.slice(0,80)}" (${titleLen} chars) — ${titleGood ? 'good length' : titleLen < 30 ? 'too short (min 30)' : 'too long (max 60)'}`
      : 'No <title> tag found — critical SEO issue.',
    'Write a unique, descriptive title with your primary keyword near the start. Keep it 30–60 characters.',
    titleExists && titleGood);

  const metaDescExists = metaDesc.length > 0;
  const metaDescGood = metaDescLen >= 120 && metaDescLen <= 160;
  add('meta_description', metaDescExists ? (metaDescGood ? 'passed' : 'warning') : 'warning', 'On-Page', 'Meta description',
    metaDescExists
      ? `Meta description (${metaDescLen} chars) — ${metaDescGood ? 'ideal length' : metaDescLen < 120 ? 'too short (min 120)' : 'too long (max 160)'}`
      : 'No meta description found. Google may auto-generate one from page content.',
    'Write a compelling 120–160 character meta description including your primary keyword and a call to action.',
    metaDescExists && metaDescGood);

  const h1Exists = h1Count > 0;
  const h1One = h1Count === 1;
  add('h1', h1Exists ? (h1One ? 'passed' : 'warning') : 'warning', 'On-Page', 'H1 heading',
    h1Exists
      ? h1One ? `H1: "${h1.slice(0,80)}" — good.` : `${h1Count} H1 tags found — should be exactly 1.`
      : 'No H1 heading found.',
    'Use exactly one H1 tag per page. It should contain your primary keyword and clearly describe the page.',
    h1Exists && h1One);

  const h2Ok = h2Count > 0;
  add('h2_structure', h2Ok ? 'passed' : 'info', 'On-Page', 'H2 headings for structure',
    h2Ok ? `${h2Count} H2 headings found — good content structure.`
         : 'No H2 headings found. Structured content helps with readability and SEO.',
    'Add H2 headings to break content into sections. Include secondary keywords in headings.',
    h2Ok);

  const altOk = imgTotal === 0 || imgMissingAlt === 0;
  add('image_alt', altOk ? 'passed' : 'warning', 'On-Page', 'Image alt text',
    imgTotal === 0 ? 'No images found on page.' : altOk
      ? `All ${imgTotal} images have alt text — good.`
      : `${imgMissingAlt} of ${imgTotal} images missing alt text.`,
    'Add descriptive alt attributes to all images: <img src="..." alt="Descriptive text about the image">. Include relevant keywords naturally.',
    altOk);

  const canonicalOk = !!canonical;
  add('canonical', canonicalOk ? 'passed' : 'info', 'On-Page', 'Canonical URL tag',
    canonicalOk ? `Canonical: ${canonical}` : 'No canonical tag found. May cause duplicate content issues.',
    'Add <link rel="canonical" href="https://yourdomain.com/page-url/"> to the <head> of every page.',
    canonicalOk);

  const wordOk = wordCount >= 300;
  add('word_count', wordOk ? 'passed' : 'warning', 'On-Page', 'Content word count',
    `~${wordCount} words on page${wordOk ? ' — good content depth.' : ' — thin content may rank poorly.'}`,
    'Aim for at least 300 words for basic pages, 1000+ for blog posts and key landing pages. Focus on quality, user intent, and covering the topic thoroughly.',
    wordOk);

  const ctaOk = hasCTA(html);
  add('cta', ctaOk ? 'passed' : 'info', 'CRO', 'Call-to-action (CRO)',
    ctaOk ? 'CTA phrases detected — good for conversions.'
           : 'No clear call-to-action found. Visitors may not know what action to take.',
    'Add clear CTAs like "Get a Free Quote", "Contact Us", "Buy Now" or "Book a Demo". Place them above the fold and throughout the page.',
    ctaOk);

  // Social / Structured Data
  const ogOk = !!(ogTitle && ogDesc && ogImage);
  add('open_graph', ogOk ? 'passed' : 'info', 'Social', 'Open Graph tags',
    ogOk ? 'og:title, og:description, og:image all set — great for social sharing.'
         : `Missing OG tags: ${[!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean).join(', ')}.`,
    'Add Open Graph tags to <head>:\n<meta property="og:title" content="Page Title">\n<meta property="og:description" content="...">\n<meta property="og:image" content="https://yourdomain.com/image.jpg">',
    ogOk);

  const twitterOk = hasTwitterCard(html);
  add('twitter_card', twitterOk ? 'passed' : 'info', 'Social', 'Twitter/X card',
    twitterOk ? 'Twitter card meta tag found.' : 'No Twitter card found. Links shared on Twitter/X won\'t show rich previews.',
    'Add <meta name="twitter:card" content="summary_large_image"> and corresponding twitter:title, twitter:description, twitter:image tags.',
    twitterOk);

  const structuredOk = hasStructuredData(html);
  add('structured_data', structuredOk ? 'passed' : 'info', 'Social', 'Structured data (Schema.org)',
    structuredOk ? 'JSON-LD structured data found — eligible for rich results in Google.'
                 : 'No JSON-LD structured data found. Missing out on rich snippets in search results.',
    'Add JSON-LD structured data to your pages. For a business: use LocalBusiness schema. For products: use Product schema. Use Google\'s Rich Results Test to validate.',
    structuredOk);

  const hreflangOk = hasHreflang(html);
  add('hreflang', hreflangOk ? 'passed' : 'info', 'Technical', 'hreflang for geo-targeting',
    hreflangOk ? 'hreflang tags found — good for multi-language/region targeting.'
               : 'No hreflang tags. If targeting multiple countries or languages, hreflang is required.',
    'Add hreflang tags in <head> for each language/region variant:\n<link rel="alternate" hreflang="en-IN" href="https://yourdomain.com/in/">\nSubmit alternate URLs in Google Search Console.',
    hreflangOk);

  // Keyword checks (only if keywords are tracked)
  if (keywords.length > 0) {
    const primaryKw = keywords[0].keyword.toLowerCase();
    const titleHasKw = title.toLowerCase().includes(primaryKw);
    add('kw_in_title', titleHasKw ? 'passed' : 'warning', 'On-Page', `Keyword "${keywords[0].keyword}" in title`,
      titleHasKw ? `Primary keyword found in title tag.` : `Primary keyword "${keywords[0].keyword}" not in title.`,
      `Include your primary keyword "${keywords[0].keyword}" naturally near the beginning of the title tag.`,
      titleHasKw);

    const descHasKw = metaDesc.toLowerCase().includes(primaryKw);
    add('kw_in_meta', descHasKw ? 'passed' : 'warning', 'On-Page', `Keyword "${keywords[0].keyword}" in meta description`,
      descHasKw ? 'Primary keyword found in meta description.' : `Primary keyword not in meta description.`,
      `Naturally include "${keywords[0].keyword}" in your meta description.`,
      descHasKw);

    const h1HasKw = h1.toLowerCase().includes(primaryKw);
    add('kw_in_h1', h1HasKw ? 'passed' : 'info', 'On-Page', `Keyword "${keywords[0].keyword}" in H1`,
      h1HasKw ? 'Primary keyword found in H1.' : 'Primary keyword not found in H1.',
      `Include "${keywords[0].keyword}" in your H1 heading.`,
      h1HasKw);
  }

  // ── Calculate score ───────────────────────────────────────────────────────

  let score = 100;
  const counts = { critical: 0, warning: 0, info: 0, passed: 0 };
  for (const issue of issues) {
    if (issue.passed) { counts.passed++; continue; }
    if (issue.severity === 'critical') { counts.critical++; score -= 15; }
    else if (issue.severity === 'warning') { counts.warning++; score -= 7; }
    else if (issue.severity === 'info') { counts.info++; score -= 3; }
  }
  score = Math.max(0, Math.min(100, score));

  const summary = {
    responseTime: page.responseTime,
    httpStatus: page.status,
    wordCount,
    internalLinks,
    externalLinks,
    imagesTotal: imgTotal,
    imagesMissingAlt: imgMissingAlt,
    ...counts,
  };

  const pageData = {
    title, titleLength: titleLen,
    metaDescription: metaDesc, metaDescLength: metaDescLen,
    h1, h1Count, h2Count,
    canonical, lang, charset, robotsMeta,
    isHttps, hasViewport: viewportOk, hasSitemap, hasRobots,
    hasOG: !!(ogTitle && ogDesc), ogTitle, ogDesc, ogImage,
    hasTwitterCard: twitterOk,
    hasStructuredData: structuredOk,
    hasHreflang: hreflangOk,
    hasCTA: ctaOk,
  };

  return { score, summary, issues, pageData };
};
