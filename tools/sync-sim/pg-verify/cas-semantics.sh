#!/usr/bin/env bash
# Verifies, on a THROWAWAY LOCAL Postgres 16 (unix socket only; no network, no Supabase), the database-level
# facts the sync compare-and-swap relies on. Usage: PGDIR=/var/tmp/sync-pgcheck PGPORT=54433 ./cas-semantics.sh
# (cluster created with: initdb -A trust; pg_ctl -o "-c listen_addresses='' -c unix_socket_directories=$PGDIR" start)
set -euo pipefail
D=${PGDIR:-/var/tmp/sync-pgcheck}; PORT=${PGPORT:-54433}
P="psql -h $D -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -X -Atq"
$P -c "drop table if exists t_tstz, t_ts6, t_ts0, snap; create table t_tstz(user_id text primary key, updated_at timestamptz); create table t_ts6(user_id text primary key, updated_at timestamp); create table t_ts0(user_id text primary key, updated_at timestamp(0)); create table snap(user_id text primary key, snapshot jsonb, updated_at timestamptz);"
echo "E1 precision: a JS-style ms ISO string, stored, read back as text, and matched by an equality filter"
for t in t_tstz t_ts6 t_ts0; do $P -c "insert into $t values ('u','2026-10-15T06:00:00.123Z')"; $P -c "select '$t', updated_at::text, (select count(*) from $t x where x.updated_at='2026-10-15T06:00:00.123Z') from $t"; done
echo "E1b timestamp(0) rounds: distinct writes can share one token"
$P -c "select ('2026-10-15T06:00:00.123Z'::timestamp(0) = '2026-10-15T06:00:00.400Z'::timestamp(0))"
echo "E2 a BEFORE UPDATE trigger that sets now() overrides a client-supplied updated_at"
$P -c "drop table if exists t_trg; create table t_trg(user_id text primary key, updated_at timestamptz default now()); create or replace function touch() returns trigger language plpgsql as \$\$ begin new.updated_at := now(); return new; end \$\$; create trigger trg before update on t_trg for each row execute function touch(); insert into t_trg values ('u','2026-01-01Z');"
$P -c "update t_trg set updated_at='2030-01-01Z' where user_id='u' returning (updated_at > '2031-01-01Z') as client_value_kept"
echo "E3a conditional UPDATE under truly overlapping transactions (READ COMMITTED)"
$P -c "insert into snap values ('u','{\"v\":\"base\"}','2026-10-15T06:00:00.000Z')"
( $P <<'SQL' > $D/a.out 2>&1 &
begin;
update snap set snapshot='{"v":"A"}', updated_at='2026-10-15T06:00:01.000Z' where user_id='u' and updated_at='2026-10-15T06:00:00.000Z' returning 'A updated rows';
select pg_sleep(2);
commit;
SQL
)
sleep 0.6
$P <<'SQL' > $D/b.out 2>&1
begin;
update snap set snapshot='{"v":"B"}', updated_at='2026-10-15T06:00:02.000Z' where user_id='u' and updated_at='2026-10-15T06:00:00.000Z' returning 'B updated rows';
commit;
SQL
sleep 2.5; echo "A returned: $(tr '\n' ' ' < $D/a.out)"; echo "B returned: [$(tr '\n' ' ' < $D/b.out)] (empty = 0 rows = conflict detected)"
$P -c "select 'final', snapshot::text from snap"
echo "E3b check-then-write loses an update; E3c unconditional upsert (what the app does today) overwrites"
$P -c "update snap set snapshot='{\"v\":\"base\"}', updated_at='2026-10-15T06:00:00.000Z'"
( $P <<'SQL' > $D/a2.out 2>&1 &
select updated_at::text from snap;
update snap set snapshot='{"v":"A"}', updated_at='2026-10-15T06:00:01.000Z';
SQL
)
$P <<'SQL' > $D/b2.out 2>&1
select updated_at::text from snap;
select pg_sleep(1);
update snap set snapshot='{"v":"B"}', updated_at='2026-10-15T06:00:02.000Z';
SQL
sleep 1; $P -c "select 'check-then-write final', snapshot::text from snap"
$P -c "insert into snap values ('u','{\"v\":\"stale\"}', now()) on conflict (user_id) do update set snapshot=excluded.snapshot, updated_at=excluded.updated_at returning 'upsert final', snapshot::text"
