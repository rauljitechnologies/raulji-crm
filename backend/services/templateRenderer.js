// backend/services/templateRenderer.js
// Renders message templates with lead/company variable substitution

const KNOWN_VARS = ['name','service','city','state','country','phone','email','status','company','source','priority'];

// Always create a fresh regex — shared global /g regex has persistent lastIndex state
const makeVarRegex = () => /\{\{(\w+)\}\}/g;

// Render a template body with lead and company data
exports.renderTemplate = (body, lead = {}, companyName = 'Raulji Technologies') => {
  return body.replace(makeVarRegex(), (_, key) => {
    switch (key) {
      case 'name':     return lead.name        || 'there';
      case 'service':  return lead.service     || 'your requirement';
      case 'city':     return lead.city        || '';
      case 'state':    return lead.state       || '';
      case 'country':  return lead.country     || 'India';
      case 'phone':    return lead.phone       || '';
      case 'email':    return lead.email       || '';
      case 'status':   return lead.status      || '';
      case 'source':   return lead.source      || '';
      case 'priority': return lead.priority    || '';
      case 'company':  return companyName;
      default:         return `{{${key}}}`;
    }
  });
};

// Extract variable names from a template body
exports.extractVariables = (body) => {
  const vars = new Set();
  const re = makeVarRegex();
  let m;
  while ((m = re.exec(body)) !== null) vars.add(m[1]);
  return [...vars];
};

// Validate a template body — returns unknown variables
exports.validateTemplate = (body) => {
  const vars = exports.extractVariables(body);
  const unknownVars = vars.filter(v => !KNOWN_VARS.includes(v));
  return { valid: unknownVars.length === 0, unknownVars };
};

exports.KNOWN_VARS = KNOWN_VARS;
