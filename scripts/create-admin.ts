#!/usr/bin/env npx tsx
/**
 * Bezbedno kreiranje ili eksplicitno ažuriranje ADMIN/OPERATOR naloga.
 *
 * Lozinka nikada nije podržana kao argument komandne linije. Prosledite je
 * preko standardnog ulaza ili je unesite u maskiranom interaktivnom promptu.
 */

import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline";
import { normalizeEmailAddress } from "../lib/auth/email-address";
import {
  MAX_BCRYPT_PASSWORD_BYTES,
  hashPassword,
  validatePassword,
} from "../lib/auth/password";
import {
  createPrismaPrivilegedAccountDatabase,
  provisionPrivilegedAccount,
  type PrivilegedAccountRole,
} from "../lib/auth/privileged-account";

interface CliArguments {
  email?: string;
  role?: string;
  passwordStdin: boolean;
  updateExisting: boolean;
  help: boolean;
}

class CliInputError extends Error {}
class CliCancelledError extends Error {}

const PASSWORD_STDIN_MAX_BYTES = MAX_BCRYPT_PASSWORD_BYTES + 2;
const MASKED_PASSWORD_MAX_CHARACTERS = 4_096;

function parseArguments(argv: readonly string[]): CliArguments {
  // Reject the legacy secret-bearing argument even when help was requested.
  // Never interpolate the supplied argument or adjacent value into output.
  if (
    argv.some(
      (argument) =>
        argument === "--password" || argument.startsWith("--password="),
    )
  ) {
    throw new CliInputError(
      "Lozinka kroz argument komandne linije nije dozvoljena.",
    );
  }

  const result: CliArguments = {
    passwordStdin: false,
    updateExisting: false,
    help: false,
  };
  const seen = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }

    if (argument === "--password-stdin") {
      if (seen.has(argument)) throw new CliInputError("Duplirana opcija.");
      seen.add(argument);
      result.passwordStdin = true;
      continue;
    }

    if (argument === "--update-existing") {
      if (seen.has(argument)) throw new CliInputError("Duplirana opcija.");
      seen.add(argument);
      result.updateExisting = true;
      continue;
    }

    if (argument === "--email" || argument === "--role") {
      if (seen.has(argument)) throw new CliInputError("Duplirana opcija.");
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new CliInputError("Opciji nedostaje vrednost.");
      }
      seen.add(argument);
      if (argument === "--email") result.email = value;
      else result.role = value;
      index += 1;
      continue;
    }

    throw new CliInputError("Nepoznata opcija.");
  }

  return result;
}

function printHelp(): void {
  console.log(`
Kreiranje ili ažuriranje privilegovanog naloga

Upotreba:
  npx tsx scripts/create-admin.ts [opcije]

Opcije:
  --email <adresa>       Email adresa naloga
  --role <uloga>         Isključivo ADMIN ili OPERATOR
  --password-stdin       Čitaj lozinku sa standardnog ulaza
  --update-existing      Izričito dozvoli izmenu postojećeg naloga
  --help, -h             Prikaži pomoć

Bez --password-stdin lozinka se unosi kroz maskirani TTY prompt.
Opcija --password nije dozvoljena zato što tajne ostaju u istoriji komandi i
listi procesa. Promena uloge i opoziv postojećih JWT/sesija su zasebne radnje.
`);
}

function promptVisible(question: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.reject(new CliInputError("Potreban je interaktivni TTY."));
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    readline.once("SIGINT", () => {
      readline.close();
      reject(new CliCancelledError());
    });
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

function promptMaskedPassword(question: string): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(
      new CliInputError("Maskirani unos zahteva interaktivni TTY."),
    );
  }

  return new Promise((resolve, reject) => {
    let password = "";
    let settled = false;
    const wasRaw = input.isRaw === true;
    const wasPaused = input.isPaused();

    const cleanup = () => {
      input.removeListener("data", onData);
      input.setRawMode?.(wasRaw);
      if (wasPaused) input.pause();
    };

    const finish = (result: string | Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      output.write("\n");
      if (typeof result === "string") resolve(result);
      else reject(result);
    };

    const onData = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (const character of text) {
        if (character === "\r" || character === "\n") {
          finish(password);
          return;
        }
        if (character === "\u0003" || character === "\u0004") {
          finish(new CliCancelledError());
          return;
        }
        if (character === "\u007f" || character === "\b") {
          const characters = Array.from(password);
          if (characters.length > 0) {
            characters.pop();
            password = characters.join("");
            output.write("\b \b");
          }
          continue;
        }

        const codePoint = character.codePointAt(0) ?? 0;
        if (codePoint < 32 || codePoint === 127) continue;
        if (Array.from(password).length >= MASKED_PASSWORD_MAX_CHARACTERS) {
          finish(new CliInputError("Unos je predugačak."));
          return;
        }
        password += character;
        output.write("*");
      }
    };

    output.write(question);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 || codePoint === 127) return true;
  }
  return false;
}

async function readPasswordFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new CliInputError(
      "--password-stdin zahteva preusmeren standardni ulaz.",
    );
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.byteLength;
    if (totalBytes > PASSWORD_STDIN_MAX_BYTES) {
      throw new CliInputError("Lozinka ne ispunjava bezbednosne uslove.");
    }
    chunks.push(buffer);
  }

  let password: string;
  try {
    password = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
  } catch {
    throw new CliInputError("Lozinka ne ispunjava bezbednosne uslove.");
  }

  if (password.endsWith("\r\n")) password = password.slice(0, -2);
  else if (password.endsWith("\n")) password = password.slice(0, -1);

  if (containsControlCharacter(password)) {
    throw new CliInputError("Lozinka ne ispunjava bezbednosne uslove.");
  }
  return password;
}

function normalizeRole(value: string): PrivilegedAccountRole | null {
  const normalized = value.trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "OPERATOR"
    ? normalized
    : null;
}

async function run(): Promise<number> {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.help) {
    printHelp();
    return 0;
  }

  if (
    arguments_.passwordStdin &&
    (!arguments_.email || !arguments_.role)
  ) {
    throw new CliInputError(
      "Uz --password-stdin obavezni su --email i --role.",
    );
  }

  const submittedEmail =
    arguments_.email ?? (await promptVisible("Email adresa: "));
  const normalizedEmail = normalizeEmailAddress(submittedEmail);
  if (!normalizedEmail) {
    throw new CliInputError("Email adresa nije validna.");
  }

  const submittedRole = arguments_.role ?? (await promptVisible("Uloga: "));
  const role = normalizeRole(submittedRole);
  if (!role) {
    throw new CliInputError("Uloga mora biti ADMIN ili OPERATOR.");
  }

  let password = arguments_.passwordStdin
    ? await readPasswordFromStdin()
    : await promptMaskedPassword("Lozinka: ");
  const validation = validatePassword(password);
  if (!validation.valid) {
    password = "";
    throw new CliInputError(
      "Lozinka ne ispunjava propisane bezbednosne uslove.",
    );
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } finally {
    // Best-effort shortening of the lifetime of the plaintext reference.
    password = "";
  }

  const prisma = new PrismaClient();
  try {
    const result = await provisionPrivilegedAccount(
      {
        email: normalizedEmail,
        passwordHash,
        role,
        updateExisting: arguments_.updateExisting,
      },
      createPrismaPrivilegedAccountDatabase(prisma),
    );

    if (result.kind === "exists") {
      console.log(
        "Nalog već postoji; bez --update-existing ništa nije promenjeno.",
      );
      return 2;
    }

    if (result.kind === "created") {
      console.log("Privilegovani nalog je uspešno kreiran.");
      return 0;
    }

    console.log("Privilegovani nalog je uspešno ažuriran.");
    console.warn(
      "Upozorenje: postojeći JWT/sesije nisu opozvani; opoziv je zasebna operacija.",
    );
    return 0;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      // Do not expose a raw disconnect error or let it mask the coarse result.
    }
  }
}

run()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    if (error instanceof CliCancelledError) {
      console.error("Operacija je otkazana.");
    } else if (error instanceof CliInputError) {
      // These messages are fixed strings and never include submitted values.
      console.error(error.message);
    } else {
      console.error("Operacija nije uspela zbog interne greške.");
    }
    process.exitCode = 1;
  });
