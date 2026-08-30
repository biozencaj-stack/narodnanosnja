import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const fixtureCutoff = "2026-01-01T00:00:00.000Z";
const fixtureGraceDeadline = new Date(
  Date.now() + 14 * 24 * 60 * 60 * 1000,
).toISOString();
const testDatabases = {
  legacy: "auth_audit_legacy_provera",
  blocked: "auth_audit_current_blocked_provera",
  clean: "auth_audit_current_clean_provera",
} as const;

type AggregateReport = Readonly<Record<string, number>>;

const expectedLegacy: AggregateReport = {
  "users.total": 7,
  "users.email.canonical_valid": 5,
  "users.email.valid_after_trim_lower": 1,
  "users.email.irreparable_invalid": 1,
  "users.email.normalized_duplicate_groups": 1,
  "users.email.normalized_duplicate_rows": 2,
  "users.role.customer.verified": 2,
  "users.role.customer.unverified": 3,
  "users.role.operator.verified": 1,
  "users.role.operator.unverified": 0,
  "users.role.admin.verified": 0,
  "users.role.admin.unverified": 1,
  "users.role.unexpected": 0,
  "users.created_at.nonfinite": 0,
  "users.created_at.in_future": 1,
  "users.verified.before_created_at": 1,
  "users.verified.in_future": 1,
  "users.unverified.without_token": 2,
  "users.unverified.with_active_token": 1,
  "users.unverified.with_only_expired_tokens": 1,
  "tokens.credential.legacy": 2,
  "tokens.credential.malformed": 1,
  "tokens.created_at.nonfinite": 0,
  "tokens.created_at.in_future": 0,
  "tokens.expires.nonfinite": 1,
  "tokens.lifetime.invalid": 0,
  "users.verified.with_leftover_tokens": 1,
  "users.unverified.with_order": 1,
  "users.unverified.with_address": 1,
  "users.unverified.with_wishlist": 1,
  "users.unverified.with_review": 1,
  "users.unverified.with_active_db_session_telemetry_only": 1,
  "users.unverified.with_active_password_reset": 1,
  "users.unverified.with_coupon_usage": 1,
  "users.unverified.with_any_activity": 3,
  "users.password.invalid_or_unsupported_bcrypt_format": 1,
  "users.password.valid_format_but_non_cost_12": 1,
};

const expectedBlockedCurrent: AggregateReport = {
  "users.total": 10,
  "users.email.canonical_valid": 8,
  "users.email.valid_after_trim_lower": 1,
  "users.email.irreparable_invalid": 1,
  "users.email.normalized_duplicate_groups": 1,
  "users.email.normalized_duplicate_rows": 2,
  "users.role.customer.verified": 2,
  "users.role.customer.unverified": 6,
  "users.role.operator.verified": 1,
  "users.role.operator.unverified": 0,
  "users.role.admin.verified": 0,
  "users.role.admin.unverified": 1,
  "users.role.unexpected": 0,
  "users.created_at.nonfinite": 1,
  "users.created_at.in_future": 1,
  "users.verified.before_created_at": 1,
  "users.verified.in_future": 1,
  "users.unverified.without_token": 4,
  "users.unverified.with_active_token": 1,
  "users.unverified.with_only_expired_tokens": 1,
  "tokens.credential.current_hash": 2,
  "tokens.credential.legacy": 1,
  "tokens.credential.malformed": 1,
  "tokens.created_at.nonfinite": 0,
  "tokens.created_at.in_future": 0,
  "tokens.expires.nonfinite": 1,
  "tokens.lifetime.invalid": 1,
  "users.verified.with_leftover_tokens": 1,
  "users.throttle.all_null": 6,
  "users.throttle.all_valid": 2,
  "users.throttle.partial_or_invalid": 2,
  "users.throttle.future_or_clock_skew": 1,
  "users.verified.with_nonnull_throttle": 1,
  "users.login_grace.null": 4,
  "users.login_grace.active": 4,
  "users.login_grace.expired": 1,
  "users.login_grace.nonfinite": 1,
  "users.login_grace.excessive_future": 1,
  "users.login_grace.verified_nonnull": 1,
  "users.login_grace.before_created_at": 0,
  "users.unverified.with_order": 1,
  "users.unverified.with_address": 1,
  "users.unverified.with_wishlist": 1,
  "users.unverified.with_review": 1,
  "users.unverified.with_active_db_session_telemetry_only": 1,
  "users.unverified.with_active_password_reset": 1,
  "users.unverified.with_coupon_usage": 1,
  "users.unverified.with_any_activity": 4,
  "users.password.invalid_or_unsupported_bcrypt_format": 1,
  "users.password.valid_format_but_non_cost_12": 1,
};

const expectedCleanCurrent: AggregateReport = {
  "users.total": 5,
  "users.email.canonical_valid": 5,
  "users.email.valid_after_trim_lower": 0,
  "users.email.irreparable_invalid": 0,
  "users.email.normalized_duplicate_groups": 0,
  "users.email.normalized_duplicate_rows": 0,
  "users.role.customer.verified": 1,
  "users.role.customer.unverified": 2,
  "users.role.operator.verified": 1,
  "users.role.operator.unverified": 0,
  "users.role.admin.verified": 1,
  "users.role.admin.unverified": 0,
  "users.role.unexpected": 0,
  "users.created_at.nonfinite": 0,
  "users.created_at.in_future": 0,
  "users.verified.before_created_at": 0,
  "users.verified.in_future": 0,
  "users.unverified.without_token": 0,
  "users.unverified.with_active_token": 2,
  "users.unverified.with_only_expired_tokens": 0,
  "tokens.credential.current_hash": 1,
  "tokens.credential.legacy": 1,
  "tokens.credential.malformed": 0,
  "tokens.created_at.nonfinite": 0,
  "tokens.created_at.in_future": 0,
  "tokens.expires.nonfinite": 0,
  "tokens.lifetime.invalid": 0,
  "users.verified.with_leftover_tokens": 0,
  "users.throttle.all_null": 4,
  "users.throttle.all_valid": 1,
  "users.throttle.partial_or_invalid": 0,
  "users.throttle.future_or_clock_skew": 0,
  "users.verified.with_nonnull_throttle": 0,
  "users.login_grace.null": 4,
  "users.login_grace.active": 1,
  "users.login_grace.expired": 0,
  "users.login_grace.nonfinite": 0,
  "users.login_grace.excessive_future": 0,
  "users.login_grace.verified_nonnull": 0,
  "users.login_grace.before_created_at": 0,
  "users.unverified.with_order": 0,
  "users.unverified.with_address": 0,
  "users.unverified.with_wishlist": 0,
  "users.unverified.with_review": 0,
  "users.unverified.with_active_db_session_telemetry_only": 0,
  "users.unverified.with_active_password_reset": 0,
  "users.unverified.with_coupon_usage": 0,
  "users.unverified.with_any_activity": 0,
  "users.password.invalid_or_unsupported_bcrypt_format": 0,
  "users.password.valid_format_but_non_cost_12": 0,
};

const expectedBlockedPreflight: AggregateReport = {
  "preflight.target_policy.not_staged": 0,
  "preflight.cutoff.invalid": 0,
  "preflight.grace_deadline.invalid": 0,
  "preflight.email.valid_after_trim_lower": 1,
  "preflight.email.irreparable_invalid": 1,
  "preflight.email.normalized_duplicate_groups": 1,
  "preflight.email.normalized_duplicate_rows": 2,
  "preflight.role.operator_unverified": 0,
  "preflight.role.admin_unverified": 1,
  "preflight.jwt_session_revalidation.unavailable": 1,
  "preflight.role.unexpected": 0,
  "preflight.created_at.nonfinite": 1,
  "preflight.created_at.in_future": 1,
  "preflight.verified.before_created_at": 1,
  "preflight.verified.in_future": 1,
  "preflight.tokens.malformed": 1,
  "preflight.tokens.created_at.nonfinite": 0,
  "preflight.tokens.created_at.in_future": 0,
  "preflight.tokens.expires.nonfinite": 1,
  "preflight.tokens.lifetime.invalid": 1,
  "preflight.verified.with_leftover_tokens": 1,
  "preflight.throttle.partial_or_invalid": 2,
  "preflight.throttle.future_or_clock_skew": 1,
  "preflight.verified.with_nonnull_throttle": 1,
  "preflight.login_grace.nonfinite": 1,
  "preflight.login_grace.unapproved_deadline": 2,
  "preflight.login_grace.before_created_at": 0,
  "preflight.login_grace.verified_nonnull": 1,
  "preflight.login_grace.post_cutoff_nonnull": 1,
  "preflight.legacy_unverified_without_active_grace": 3,
  "preflight.unverified_activity_without_active_grace": 2,
  "preflight.unverified.with_active_db_session_telemetry_only": 1,
  "preflight.password.invalid_or_unsupported_bcrypt_format": 1,
  "preflight.password.valid_format_but_non_cost_12": 1,
  "preflight.blocking_categories": 23,
  "preflight.ready": 0,
};

const expectedCleanPreflight: AggregateReport = Object.fromEntries(
  Object.keys(expectedBlockedPreflight).map((category) => [
    category,
    category === "preflight.jwt_session_revalidation.unavailable" ||
    category === "preflight.blocking_categories"
      ? 1
      : 0,
  ]),
);

function assertSafeBaseDatabaseUrl(rawUrl: string | undefined): URL {
  if (process.env.CI !== "true") {
    throw new Error("Auth audit database fixtures are CI-only");
  }
  if (!rawUrl) {
    throw new Error("AUTH_AUDIT_TEST_DATABASE_URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Auth audit test database URL is invalid");
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error("Auth audit tests require PostgreSQL");
  }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname)) {
    throw new Error("Auth audit tests require a loopback PostgreSQL host");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (databaseName !== "provera") {
    throw new Error("Auth audit fixtures require the dedicated CI base database");
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed;
}

function databaseUrl(baseUrl: URL, databaseName: string): string {
  if (!Object.values(testDatabases).includes(databaseName as never)) {
    throw new Error("Refusing an unapproved auth audit database name");
  }
  const target = new URL(baseUrl);
  target.pathname = `/${databaseName}`;
  target.search = '';
  target.hash = '';
  return target.toString();
}

interface CommandResult {
  status: number;
  stdout: string;
}

const allowedPsqlVariableNames = new Set([
  "fixture_grace_deadline",
  "fixture_legacy_cutoff",
  "grace_deadline",
  "legacy_cutoff",
  "target_policy",
]);

type PsqlVariables = Readonly<Record<string, string>>;

function appendPsqlVariables(args: string[], variables: PsqlVariables): void {
  for (const [name, value] of Object.entries(variables)) {
    if (
      !allowedPsqlVariableNames.has(name) ||
      value.length === 0 ||
      /[\0\r\n]/.test(value)
    ) {
      throw new Error("Refusing an invalid auth audit psql variable");
    }
    args.push(`--set=${name}=${value}`);
  }
}

function run(
  executable: string,
  args: string[],
  allowedStatuses: readonly number[] = [0],
): CommandResult {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGCONNECT_TIMEOUT: '5',
    },
    maxBuffer: 8 * 1024 * 1024,
  });

  const status = result.status ?? -1;
  if (result.error || !allowedStatuses.includes(status)) {
    throw new Error(
      `Auth audit fixture command failed safely: ${path.basename(executable)} status=${status}`,
    );
  }

  return { status, stdout: result.stdout ?? '' };
}

function dropDatabase(baseUrl: URL, databaseName: string): void {
  run('dropdb', [
    '--if-exists',
    '--force',
    `--maintenance-db=${baseUrl.toString()}`,
    databaseName,
  ]);
}

function createDatabase(baseUrl: URL, databaseName: string): string {
  dropDatabase(baseUrl, databaseName);
  run('createdb', [
    `--maintenance-db=${baseUrl.toString()}`,
    databaseName,
  ]);
  return databaseUrl(baseUrl, databaseName);
}

function runSqlFile(
  targetUrl: string,
  relativePath: string,
  variables: PsqlVariables = {},
): void {
  const args = [
    '-X',
    '--quiet',
    '--set=ON_ERROR_STOP=1',
  ];
  appendPsqlVariables(args, variables);
  args.push(`--file=${path.join(repositoryRoot, relativePath)}`, targetUrl);
  run('psql', args);
}

function applyLegacyBaseline(targetUrl: string): void {
  runSqlFile(
    targetUrl,
    'prisma/migrations/20260829000000_baseline_production_before_v2/migration.sql',
  );
}

function applyAllMigrations(targetUrl: string): void {
  const migrationsRoot = path.join(repositoryRoot, 'prisma/migrations');
  const migrationDirectories = readdirSync(migrationsRoot, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationDirectory of migrationDirectories) {
    runSqlFile(
      targetUrl,
      path.join('prisma/migrations', migrationDirectory, 'migration.sql'),
    );
  }
}

function runAggregateScript(
  targetUrl: string,
  relativePath: string,
  options: {
    cutoff?: string;
    graceDeadline?: string;
    targetPolicy?: string;
    allowedStatuses?: readonly number[];
  } = {},
): CommandResult {
  const args = [
    '-X',
    '--quiet',
    '--tuples-only',
    '--no-align',
    '--field-separator=|',
    '--set=ON_ERROR_STOP=1',
  ];
  const variables: Record<string, string> = {};
  if (options.cutoff) {
    variables.legacy_cutoff = options.cutoff;
  }
  if (options.graceDeadline) {
    variables.grace_deadline = options.graceDeadline;
  }
  if (options.targetPolicy) {
    variables.target_policy = options.targetPolicy;
  }
  appendPsqlVariables(args, variables);
  args.push(`--file=${path.join(repositoryRoot, relativePath)}`, targetUrl);
  return run('psql', args, options.allowedStatuses ?? [0]);
}

function parseAggregateReport(output: string): Record<string, number> {
  const lines = output.trim() ? output.trim().split(/\r?\n/) : [];
  const actual: Record<string, number> = {};

  for (const line of lines) {
    const match = /^([a-z0-9._-]+)\|([0-9]+)$/.exec(line);
    assert.ok(match, 'Aggregate audit emitted a non category|count line');
    assert.equal(actual[match[1]], undefined, 'Aggregate audit repeated a category');
    actual[match[1]] = Number(match[2]);
  }

  return actual;
}

function assertAggregateReport(
  output: string,
  expected: AggregateReport,
): void {
  assert.deepEqual(parseAggregateReport(output), expected);
}

function assertAggregateCategory(
  output: string,
  category: string,
  expectedCount: number,
): void {
  const report = parseAggregateReport(output);
  assert.equal(report[category], expectedCount);
  assert.equal(report["preflight.ready"], 0);
}

function main(): void {
  const baseUrl = assertSafeBaseDatabaseUrl(
    process.env.AUTH_AUDIT_TEST_DATABASE_URL,
  );
  const createdDatabases: string[] = [];

  try {
    const legacyUrl = createDatabase(baseUrl, testDatabases.legacy);
    createdDatabases.push(testDatabases.legacy);
    applyLegacyBaseline(legacyUrl);
    runSqlFile(legacyUrl, 'scripts/auth-audit-fixtures/legacy.sql');
    assertAggregateReport(
      runAggregateScript(
        legacyUrl,
        'scripts/auth-email-verification-audit-legacy.sql',
      ).stdout,
      expectedLegacy,
    );

    const currentAgainstLegacy = runAggregateScript(
      legacyUrl,
      'scripts/auth-email-verification-audit-current.sql',
      { allowedStatuses: [3] },
    );
    assert.equal(currentAgainstLegacy.stdout.trim(), '');

    const blockedUrl = createDatabase(baseUrl, testDatabases.blocked);
    createdDatabases.push(testDatabases.blocked);
    applyAllMigrations(blockedUrl);

    const legacyAgainstCurrent = runAggregateScript(
      blockedUrl,
      'scripts/auth-email-verification-audit-legacy.sql',
      { allowedStatuses: [3] },
    );
    assert.equal(legacyAgainstCurrent.stdout.trim(), '');

    runSqlFile(blockedUrl, 'scripts/auth-audit-fixtures/current-blocked.sql', {
      fixture_grace_deadline: fixtureGraceDeadline,
      fixture_legacy_cutoff: fixtureCutoff,
    });
    assertAggregateReport(
      runAggregateScript(
        blockedUrl,
        'scripts/auth-email-verification-audit-current.sql',
      ).stdout,
      expectedBlockedCurrent,
    );

    const missingCutoff = runAggregateScript(
      blockedUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        graceDeadline: fixtureGraceDeadline,
        targetPolicy: 'staged',
        allowedStatuses: [2],
      },
    );
    assert.equal(missingCutoff.stdout.trim(), '');

    const missingGraceDeadline = runAggregateScript(
      blockedUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        cutoff: fixtureCutoff,
        targetPolicy: 'staged',
        allowedStatuses: [2],
      },
    );
    assert.equal(missingGraceDeadline.stdout.trim(), '');

    const missingTargetPolicy = runAggregateScript(
      blockedUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        cutoff: fixtureCutoff,
        graceDeadline: fixtureGraceDeadline,
        allowedStatuses: [2],
      },
    );
    assert.equal(missingTargetPolicy.stdout.trim(), '');

    const blockedPreflight = runAggregateScript(
      blockedUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        cutoff: fixtureCutoff,
        graceDeadline: fixtureGraceDeadline,
        targetPolicy: 'staged',
        allowedStatuses: [3],
      },
    );
    assertAggregateReport(blockedPreflight.stdout, expectedBlockedPreflight);

    const cleanUrl = createDatabase(baseUrl, testDatabases.clean);
    createdDatabases.push(testDatabases.clean);
    applyAllMigrations(cleanUrl);
    runSqlFile(cleanUrl, 'scripts/auth-audit-fixtures/current-clean.sql', {
      fixture_grace_deadline: fixtureGraceDeadline,
    });
    assertAggregateReport(
      runAggregateScript(
        cleanUrl,
        'scripts/auth-email-verification-audit-current.sql',
      ).stdout,
      expectedCleanCurrent,
    );
    const cleanPreflight = runAggregateScript(
      cleanUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        cutoff: fixtureCutoff,
        graceDeadline: fixtureGraceDeadline,
        targetPolicy: 'staged',
        allowedStatuses: [3],
      },
    );
    assertAggregateReport(cleanPreflight.stdout, expectedCleanPreflight);

    const strictRejected = runAggregateScript(
      cleanUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        cutoff: fixtureCutoff,
        graceDeadline: fixtureGraceDeadline,
        targetPolicy: 'strict',
        allowedStatuses: [3],
      },
    );
    assertAggregateReport(strictRejected.stdout, {
      ...expectedCleanPreflight,
      'preflight.target_policy.not_staged': 1,
      'preflight.blocking_categories': 2,
      'preflight.ready': 0,
    });

    for (const invalidCutoff of [
      '2026-01-01 00:00:00.000',
      '2026-01-01T00:00:00.0001Z',
      'infinity',
      '2099-01-01T00:00:00.000Z',
    ]) {
      const rejected = runAggregateScript(
        cleanUrl,
        'scripts/auth-email-verification-enforcement-preflight.sql',
        {
          cutoff: invalidCutoff,
          graceDeadline: fixtureGraceDeadline,
          targetPolicy: 'staged',
          allowedStatuses: [3],
        },
      );
      assertAggregateCategory(rejected.stdout, 'preflight.cutoff.invalid', 1);
    }

    const invalidCalendarCutoff = runAggregateScript(
      cleanUrl,
      'scripts/auth-email-verification-enforcement-preflight.sql',
      {
        cutoff: '2026-02-30T00:00:00.000Z',
        graceDeadline: fixtureGraceDeadline,
        targetPolicy: 'staged',
        allowedStatuses: [3],
      },
    );
    assert.equal(invalidCalendarCutoff.stdout.trim(), '');

    const oneDayFromNow = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const fortyFiveDaysFromNow = new Date(
      Date.now() + 45 * 24 * 60 * 60 * 1000,
    ).toISOString();
    for (const invalidGraceDeadline of [
      fixtureGraceDeadline.replace('T', ' '),
      fixtureGraceDeadline.replace(/Z$/, '1Z'),
      oneDayFromNow,
      fortyFiveDaysFromNow,
    ]) {
      const rejected = runAggregateScript(
        cleanUrl,
        'scripts/auth-email-verification-enforcement-preflight.sql',
        {
          cutoff: fixtureCutoff,
          graceDeadline: invalidGraceDeadline,
          targetPolicy: 'staged',
          allowedStatuses: [3],
        },
      );
      assertAggregateCategory(
        rejected.stdout,
        'preflight.grace_deadline.invalid',
        1,
      );
    }

    process.stdout.write('PASS: isolated aggregate auth audit fixtures\n');
  } finally {
    for (const databaseName of createdDatabases.reverse()) {
      dropDatabase(baseUrl, databaseName);
    }
  }
}

main();
