require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove } = require('firebase/database');
const firebaseConfig = require('./firebase-config');

const db = getDatabase(initializeApp(firebaseConfig));

async function deleteAllUsers() {
  console.log('🗑️  Deleting all user accounts from Firebase...\n');
  
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      console.log('✅ No users found in database.\n');
      return;
    }
    
    const users = snapshot.val();
    const userKeys = Object.keys(users);
    
    if (userKeys.length === 0) {
      console.log('✅ No users found in database.\n');
      return;
    }
    
    console.log(`Found ${userKeys.length} user account(s):`);
    userKeys.forEach((key, index) => {
      const user = users[key];
      console.log(`   ${index + 1}. ${user.email || key}`);
    });
    console.log('');
    
    // Delete all users
    for (const key of userKeys) {
      const userRef = ref(db, `users/${key}`);
      await remove(userRef);
      const user = users[key];
      console.log(`   ✅ Deleted: ${user.email || key}`);
    }
    
    console.log(`\n✅ Successfully deleted ${userKeys.length} user account(s)!\n`);
  } catch (error) {
    console.error('❌ Error deleting users:', error);
    process.exit(1);
  }
}

deleteAllUsers();

