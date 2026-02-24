
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            const value = values.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
            process.env[key.trim()] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taydakggvqgywyizhinr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Make sure .env.local exists.');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function syncDisplayNames() {
    console.log('Starting sync of Display Names...');

    // 1. Get all users from public table
    const { data: publicUsers, error: publicError } = await supabaseAdmin
        .from('users')
        .select('*');

    if (publicError) {
        console.error('Error fetching public users:', publicError);
        return;
    }

    console.log(`Found ${publicUsers.length} users in public table.`);

    // 2. Get all auth users
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching auth users:', authError);
        return;
    }

    console.log(`Found ${authUsers.length} users in auth system.`);

    // 3. Sync
    let updatedCount = 0;
    for (const pUser of publicUsers) {
        if (!pUser.auth_id && !pUser.email) continue;

        // Find auth user by ID or Email
        const authUser = authUsers.find(u => u.id === pUser.auth_id || u.email === pUser.email);

        if (authUser) {
            const currentName = authUser.user_metadata?.full_name;
            if (currentName !== pUser.ad_soyad) {
                console.log(`Updating ${pUser.email}: Metadata '${currentName}' -> '${pUser.ad_soyad}'`);

                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    authUser.id,
                    { user_metadata: { full_name: pUser.ad_soyad } }
                );

                if (updateError) {
                    console.error(`Failed to update ${pUser.email}:`, updateError.message);
                } else {
                    updatedCount++;
                }
            }
        } else {
            console.warn(`Auth user not found for public user: ${pUser.email}`);
        }
    }

    console.log(`Sync complete. Updated ${updatedCount} users.`);
}

syncDisplayNames();
