require('dotenv').config();
const bcrypt = require('bcrypt');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get } = require('firebase/database');
const firebaseConfig = require('./firebase-config');

const db = getDatabase(initializeApp(firebaseConfig));

// Helper function to encode email for Firebase key
function encodeEmailForFirebase(email) {
  return email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_dot_');
}

async function createAdmin() {
  const email = process.argv[2] || 'admin@greenhouse.local';
  const password = process.argv[3] || 'greenhouse123';
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('❌ Error: Please provide a valid email address\n');
    console.log('💡 Usage:');
    console.log('   node create-admin.js [email] [password]');
    console.log('   Example: node create-admin.js admin@example.com mySecurePassword123\n');
    process.exit(1);
  }
  
  console.log('🔐 Creating admin account...\n');
  
  // Encode email for Firebase key
  const emailKey = encodeEmailForFirebase(email);
  
  // Check if user already exists
  const usersRef = ref(db, `users/${emailKey}`);
  const snapshot = await get(usersRef);
  
  if (snapshot.exists()) {
    console.log(`⚠️  User with email "${email}" already exists!`);
    console.log('   To update the password, use the profile page after logging in.\n');
    return;
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create admin user
  const displayName = email.split('@')[0];
  const userData = {
    email: email.toLowerCase(),
    passwordHash: passwordHash,
    fullName: 'Administrator',
    displayName: displayName,
    phone: '',
    site: '',
    language: 'English',
    responsibilities: 'System administrator with full access to greenhouse controls.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastPasswordChange: Date.now(),
    role: 'admin'
  };
  
  await set(usersRef, userData);
  
  console.log('✅ Admin account created successfully!\n');
  console.log('📋 Account Details:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role: admin\n`);
  console.log('⚠️  IMPORTANT: Change the password after first login!\n');
  console.log('💡 Usage:');
  console.log('   node create-admin.js [email] [password]');
  console.log('   Example: node create-admin.js admin@example.com mySecurePassword123\n');
}

createAdmin().catch((error) => {
  console.error('❌ Error creating admin account:', error);
  process.exit(1);
});
