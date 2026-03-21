const fs = require('fs');
const doc = JSON.parse(fs.readFileSync('docs/grocy.openapi.json', 'utf8'));

doc.components = doc.components || { schemas: {} };
const schemas = doc.components.schemas;

function fixRefs(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(fixRefs);
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj['$ref'] && typeof obj['$ref'] === 'string' && obj['$ref'].startsWith('#/components/schemas/')) {
      const refName = obj['$ref'].split('/').pop();
      if (!schemas[refName]) {
        schemas[refName] = { type: 'string' };
      }
    }
    for (const key in obj) {
      fixRefs(obj[key]);
    }
  }
}

fixRefs(doc);

fs.writeFileSync('docs/grocy.openapi.json', JSON.stringify(doc, null, 2));
console.log('Patched all missing refs');
