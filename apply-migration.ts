const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key && value) {
                process.env[key] = value;
            }
        }
    });
} catch (e) {
    console.warn('Could not load .env.local', e);
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
    console.error('Please provide a migration file path (e.g. migration.sql)');
    process.exit(1);
}

async function applyMigration() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log(`Connected to database. Applying ${migrationFile}...`);
        const sqlPath = path.resolve(process.cwd(), migrationFile);
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sqlContent);
        console.log('Migration executed successfully.');
    } catch (err: any) {
        if (err.code === 'ENOTFOUND' && err.hostname?.includes('supabase.co')) {
            console.log('IPv4 DNS failed. Attempting IPv6 workaround...');
            await client.end().catch(() => { });

            // Hardcoded IPv6 from nslookup for db.taydakggvqgywyizhinr.supabase.co
            // Note: In a real scenario we'd do dns.resolve6 but we have the value.
            const ipv6 = '2406:da1a:6b0:f612:3f6b:1bbe:f596:7b2c';
            const newUrl = DATABASE_URL.replace(err.hostname, `[${ipv6}]`);

            const clientV6 = new Client({
                connectionString: newUrl,
                ssl: { rejectUnauthorized: false }
            });

            try {
                await clientV6.connect();
                console.log(`Connected via IPv6. Applying ${migrationFile}...`);
                const sqlPath = path.resolve(process.cwd(), migrationFile);
                const sqlContent = fs.readFileSync(sqlPath, 'utf8');
                await clientV6.query(sqlContent);
                console.log('Migration executed successfully via IPv6.');
                await clientV6.end();
                return;
            } catch (errV6) {
                console.error('IPv6 Connection Failed:', errV6);
            }
        } else {
            console.error('Migration Failed:', err);
        }
    } finally {
        await client.end().catch(() => { });
    }
}

applyMigration();
