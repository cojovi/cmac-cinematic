import { spawnSync } from 'node:child_process'

// pgTAP assertion failures do not make psql fail; inspect TAP as well as exit status.
const connection = process.env.DATABASE_TEST_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connection).hostname)) throw new Error('Database tests must run against a local, isolated database.')
for (const file of ['production_crm.test.sql', 'team_management.test.sql']) {
  const result = spawnSync('psql', [connection, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', `supabase/tests/${file}`], { encoding: 'utf8' })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (result.status !== 0 || /^not ok\b|Looks like you failed|planned \d+ tests but ran/m.test(output)) {
    process.stderr.write(output)
    process.exit(1)
  }
  console.log(`${file}: ${(output.match(/^ok \d+/gm) ?? []).length} assertions passed; transaction rolled back.`)
}
