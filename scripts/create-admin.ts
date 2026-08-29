#!/usr/bin/env npx tsx
/**
 * CLI Script za kreiranje Admin/Operator korisnika
 *
 * Upotreba:
 *   npx tsx scripts/create-admin.ts --email admin@[COMPANY_NAME].rs --password Lozinka123! --role ADMIN
 *   npx tsx scripts/create-admin.ts --email operator@[COMPANY_NAME].rs --password Lozinka123! --role OPERATOR
 *
 * Ili interaktivno (pita za input):
 *   npx tsx scripts/create-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as readline from "readline";

const prisma = new PrismaClient();

// Parse command line arguments
function parseArgs(): { email?: string; password?: string; role?: string } {
  const args = process.argv.slice(2);
  const result: { email?: string; password?: string; role?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      result.email = args[i + 1];
      i++;
    } else if (args[i] === "--password" && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    } else if (args[i] === "--role" && args[i + 1]) {
      result.role = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Kreiranje Admin/Operator korisnika za [COMPANY_NAME]

Upotreba:
  npx tsx scripts/create-admin.ts [opcije]

Opcije:
  --email <email>      Email adresa korisnika
  --password <pass>    Lozinka (min 8 karaktera)
  --role <role>        ADMIN ili OPERATOR
  --help, -h           Prikaži pomoć

Primeri:
  npx tsx scripts/create-admin.ts --email admin@[COMPANY_NAME].rs --password Minad123! --role ADMIN
  npx tsx scripts/create-admin.ts --email operator@[COMPANY_NAME].rs --password Ratorope123! --role OPERATOR
  npx tsx scripts/create-admin.ts  # Interaktivni režim
      `);
      process.exit(0);
    }
  }

  return result;
}

// Prompt for input
function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      // For password input - note: this won't actually hide in all terminals
      process.stdout.write(question);
      let input = "";

      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const onData = (char: string) => {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener("data", onData);
          rl.close();
          console.log();
          resolve(input);
        } else if (char === "\u0003") {
          // Ctrl+C
          process.exit();
        } else if (char === "\u007F" || char === "\b") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += char;
        }
      };

      process.stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

// Simple prompt without hiding (fallback)
function simplePrompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password
function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// Validate role
function isValidRole(role: string): role is "ADMIN" | "OPERATOR" {
  return role === "ADMIN" || role === "OPERATOR";
}

async function main() {
  console.log("\n🔐 [COMPANY_NAME] - Kreiranje Admin/Operator korisnika\n");

  const args = parseArgs();

  // Get email
  let email = args.email;
  if (!email) {
    email = await simplePrompt("Email adresa: ");
  }
  if (!isValidEmail(email)) {
    console.error("❌ Nevalidna email adresa");
    process.exit(1);
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    console.error(`❌ Korisnik sa emailom ${email} već postoji (role: ${existingUser.role})`);
    const update = await simplePrompt("Da li želite da ažurirate ovog korisnika? (da/ne): ");
    if (update.toLowerCase() !== "da" && update.toLowerCase() !== "d") {
      console.log("Operacija otkazana.");
      process.exit(0);
    }
  }

  // Get password
  let password = args.password;
  if (!password) {
    console.log("(Lozinka mora imati minimum 8 karaktera)");
    password = await simplePrompt("Lozinka: ");
  }
  if (!isValidPassword(password)) {
    console.error("❌ Lozinka mora imati minimum 8 karaktera");
    process.exit(1);
  }

  // Get role
  let role = args.role;
  if (!role) {
    role = await simplePrompt("Uloga (ADMIN/OPERATOR): ");
    role = role.toUpperCase();
  }
  if (!isValidRole(role)) {
    console.error("❌ Uloga mora biti ADMIN ili OPERATOR");
    process.exit(1);
  }

  // Hash password
  console.log("\n⏳ Kreiranje korisnika...");
  const passwordHash = await bcrypt.hash(password, 12);

  // Create or update user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
      emailVerified: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName: role === "ADMIN" ? "Admin" : "Operator",
      lastName: "[COMPANY_NAME]",
      role,
      emailVerified: new Date(),
    },
  });

  console.log(`\n✅ Korisnik uspešno ${existingUser ? "ažuriran" : "kreiran"}!`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Uloga: ${user.role}`);
  console.log(`   ID: ${user.id}`);
  console.log("\n🎉 Gotovo! Korisnik se sada može ulogovati.\n");
}

main()
  .catch((e) => {
    console.error("❌ Greška:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
