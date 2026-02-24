const fs = require('fs');
const path = require('path');

const files = ['.env', '.env.local'];

files.forEach(file => {
    try {
        const envPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(envPath)) {
            console.log(`\nChecking ${file}...`);
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                    console.log(`Found key: ${match[1].trim()}`);
                }
            });
        } else {
            console.log(`\n${file} does not exist.`);
        }
    } catch (e) {
        console.error(e);
    }
});
