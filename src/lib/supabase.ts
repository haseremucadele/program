
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://taydakggvqgywyizhinr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheWRha2dndnFneXd5aXpoaW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjIyMzUsImV4cCI6MjA4MDk5ODIzNX0.FPKTrSKcnN1p5kacOOrYwPJ3QdAcsIxC8sJ1qnTISBg';

export const supabase = createClient(supabaseUrl, supabaseKey);
