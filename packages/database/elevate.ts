import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://puzirezydceumecupgtq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1emlyZXp5ZGNldW1lY3VwZ3RxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA3NzI3NSwiZXhwIjoyMTAyNjUzMjc1fQ.JSpEcQK7BH4TEWh0xAomMFMm-tC43WktkBsV2c-TLkI';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const email = process.argv[2];
  const password = process.argv[3] || 'Password123!';

  if (!email) {
    console.error('Usage: npx tsx elevate.ts <email> [password]');
    process.exit(1);
  }

  console.log(`Checking Supabase for email: ${email}`);

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error fetching users:', listError.message);
    process.exit(1);
  }

  let user = listData.users.find(u => u.email === email);

  if (!user) {
    console.log(`User not found. Creating user in Supabase Auth...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error('Failed to create user:', createError.message);
      process.exit(1);
    }
    user = createData.user;
    console.log(`Created new Supabase user: ${user.id}`);
    console.log(`Password set to: ${password}`);
  } else {
    console.log(`Found existing user: ${user.id}`);
  }
  
  const admin = await prisma.adminUser.upsert({
    where: { authUserId: user.id },
    update: {
      role: 'SUPER_ADMIN',
      isActive: true,
      email: user.email!,
    },
    create: {
      authUserId: user.id,
      email: user.email!,
      displayName: email.split('@')[0],
      role: 'SUPER_ADMIN',
      isActive: true,
    }
  });

  console.log(`\nSuccess! Granted SUPER_ADMIN to ${admin.email}`);
  if (process.argv[3] === undefined) {
    console.log(`You can now log in with email: ${email} and password: ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
