
const fs = require('fs');
const path = 'c:\\Users\\ricar\\AppData\\Local\\Programs\\Antigravity\\resources\\app\\extensions\\antigravity\\dist\\extension.js';
const outPath = 'c:\\Users\\ricar\\Antigravity Omni-Quota\\snippet_out_5.txt';

try {
    const content = fs.readFileSync(path, 'utf8');
    // Search for method definition. Due to minification it might be `setupRoutes(e){`
    const target = 'setupRoutes(e){';
    let index = content.indexOf(target);
    
    if (index === -1) {
        // Try alternate var name
        index = content.indexOf('setupRoutes(t){');
    }
    if (index === -1) {
        index = content.indexOf('setupRoutes('); // Generic
    }
    
    if (index === -1) {
        fs.writeFileSync(outPath, 'TARGET NOT FOUND');
    } else {
        const start = Math.max(0, index - 200);
        const end = Math.min(content.length, index + 800); // More context after
        const snippet = content.substring(start, end);
        fs.writeFileSync(outPath, snippet);
        console.log('Snippet written to file.');
    }
} catch (e) {
    console.log('ERROR:', e.message);
}
