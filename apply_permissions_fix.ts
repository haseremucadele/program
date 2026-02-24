
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key && value) {
            envVars[key] = value;
        }
    }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
    console.log('Fetching users...');
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, ad_soyad');

    if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
    }

    console.log(`Found ${users.length} users. Applying attendance:view permission...`);

    const records = users.map(u => ({
        user_id: u.id,
        permission_id: 'attendance:view'
    }));

    const { error: insertError } = await supabase
        .from('user_permissions')
        .upsert(records, { onConflict: 'user_id, permission_id', ignoreDuplicates: true });

    if (insertError) {
        console.error('Error applying permissions:', insertError);
    } else {
        console.log('Permissions applied successfully!');
    }
}

applyFix();
