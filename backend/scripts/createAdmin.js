import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import { connectDatabase } from '../src/config/db.js';
import Admin from '../src/models/Admin.js';

function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readHiddenPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this script in an interactive terminal so the password can be entered without echo.');
  }
  stdout.write('Password (input hidden): ');
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Admin creation cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(password);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          password = password.slice(0, -1);
        } else if (character >= ' ') {
          password += character;
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function hasUniqueEmailIndex() {
  try {
    const indexes = await Admin.collection.indexes();
    return indexes.some((index) => index.unique === true && index.key?.email === 1);
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return false;
    throw new Error('Could not verify the admin email index. Check database availability and permissions.');
  }
}

async function run() {
  const createIndex = process.argv.includes('--create-index');
  if (process.argv.slice(2).some((argument) => argument !== '--create-index') || process.argv.filter((argument) => argument === '--create-index').length > 1) {
    throw new Error('Usage: node scripts/createAdmin.js [--create-index]');
  }
  try {
    await connectDatabase();
  } catch {
    throw new Error('Could not connect using the configured MongoDB settings.');
  }
  if (createIndex) {
    try {
      await Admin.collection.createIndex({ email: 1 }, { unique: true, name: 'uniq_admin_email' });
    } catch {
      throw new Error('Could not create the admin email unique index. Check database availability, permissions, and existing duplicates.');
    }
    console.info('Unique admin email index is ready.');
    return;
  }
  if (!(await hasUniqueEmailIndex())) {
    throw new Error('Admin email unique index is missing. Run node scripts/createAdmin.js --create-index first.');
  }

  const prompts = readline.createInterface({ input: stdin, output: stdout });
  let name, email, password;
  try {
    name = (await prompts.question('Admin name: ')).trim();
    email = (await prompts.question('Admin email: ')).normalize('NFKC').trim().toLowerCase();
  } finally {
    prompts.close();
  }
  if (!name || name.length > 100 || !validEmail(email)) {
    throw new Error('Provide a name of 1-100 characters and a valid email address.');
  }
  password = await readHiddenPassword();
  if (password.length < 12 || password.length > 1024) {
    throw new Error('Password must be between 12 and 1024 characters.');
  }
  try {
    if (await Admin.exists({ email })) throw new Error('An admin with that email already exists.');
  } catch (error) {
    if (error.message === 'An admin with that email already exists.') throw error;
    throw new Error('Could not check for an existing admin. Check database availability and permissions.');
  }

  try {
    await Admin.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
  } catch (error) {
    if (error?.code === 11000) throw new Error('An admin with that email already exists.');
    throw new Error('Admin creation failed. Check database availability and schema configuration.');
  } finally {
    password = '';
  }
  console.info('Admin account created.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      console.error('Could not close the configured MongoDB connection cleanly.');
      process.exitCode = 1;
    }
  }
}
