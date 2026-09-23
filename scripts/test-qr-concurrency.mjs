import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

const connection = process.env.DATABASE_TEST_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
if (!['127.0.0.1','localhost','[::1]'].includes(new URL(connection).hostname)) throw new Error('Concurrency tests require a local database.')
const id = randomUUID()
const hash = createHash('sha256').update(id).digest('hex')
function sql(query) {
  return new Promise((resolve,reject) => {
    const child = spawn('psql',[connection,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-f','-'])
    let output = '', error = ''
    child.stdout.on('data',chunk => { output += chunk })
    child.stderr.on('data',chunk => { error += chunk })
    child.on('error',reject)
    child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(error)))
    child.stdin.end(query)
  })
}
try {
  const visit = `begin; set local role service_role; select public.record_qr_visit('${id}','${hash}'); select pg_sleep(0.15); commit;`
  await Promise.all([sql(visit),sql(visit),sql(visit)])
  assert.equal(await sql(`select count(*) from public.qr_visits where id='${id}'`),'1')
  const answers = {name:'Concurrency QA',email:'qr-concurrency@example.com',phone:'6825550100',location:'Burleson, Texas',timing:'Immediately',units:'1-4 units',use:'Short-term rental',payment:'Cash',credit:''}
  const submit = `begin; set local role service_role; select public.submit_qr_inquiry('${id}','${id}','${JSON.stringify(answers)}','${hash}','${hash}','${hash}')->>'created'; select pg_sleep(0.15); commit;`
  const created = await Promise.all([sql(submit),sql(submit),sql(submit)])
  assert.equal(created.filter(value=>value==='true').length,1,JSON.stringify(created))
  assert.equal(created.filter(value=>value==='false').length,2)
  const claim = `begin; set local role service_role; select count(*) from public.claim_qr_notification('${id}'); select pg_sleep(0.15); commit;`
  const claims = await Promise.all([sql(claim),sql(claim),sql(claim)])
  assert.equal(claims.filter(value=>value==='1').length,1)
  assert.equal(claims.filter(value=>value==='0').length,2)
  console.log('QR concurrency: simultaneous visits, submissions, and notification claims each resolve exactly once.')
} finally {
  await sql(`begin; delete from public.qr_submissions where id='${id}'; delete from public.qr_visits where id='${id}'; delete from private.qr_rate_windows where key in ('visit:${hash}','submit:${hash}','email:${hash}'); commit;`)
}
