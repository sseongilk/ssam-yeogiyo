-- 쌤! 여기요! 공용 랭킹·채팅 (불량 판정소와 같은 Supabase 프로젝트, 표 이름 앞에 nn_)
-- 규칙: 누구나 랭킹 읽기 가능, 기록은 nn_submit 함수로만 저장
--       기기마다 무작위 id·비밀값·복구 코드. 같은 id의 줄은 비밀값이 맞을 때만 바뀜
--       복구 코드로 다른 기기(또는 저장소가 지워진 기기)에서 같은 id를 되찾음
--       최고 점수·누적 점수·오늘의 근무 점수는 내려가지 않음
-- 여러 번 실행해도 됨

create table if not exists public.nn_scores (
  id       uuid primary key,
  secret   text not null,
  code     text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  nick     text not null check (char_length(nick) between 1 and 5),
  ward     text not null default '' check (char_length(ward) <= 12),
  look     text not null default '' check (char_length(look) <= 40),
  best     integer not null default 0 check (best between 0 and 10000000),
  total    bigint not null default 0 check (total between 0 and 10000000000),
  day      date,
  day_best integer not null default 0 check (day_best between 0 and 10000000),
  at       timestamptz not null default now()
);

-- 기록·업적 (JSON 글자, 400자까지)
alter table public.nn_scores add column if not exists stats text not null default '' check (char_length(stats) <= 400);
-- 같은 이름 금지 (대소문자 무시)
create unique index if not exists nn_scores_nick_key on public.nn_scores (lower(nick));

alter table public.nn_scores enable row level security;
drop policy if exists "모두 읽기" on public.nn_scores;
create policy "모두 읽기" on public.nn_scores for select to anon, authenticated using (true);

-- 비밀값·복구 코드는 읽을 수 없게 열 단위로만 읽기 허용, 직접 쓰기는 막음
revoke all on public.nn_scores from anon, authenticated;
grant select (id, nick, ward, look, best, total, stats, day, day_best, at) on public.nn_scores to anon, authenticated;

drop function if exists public.nn_submit(uuid, text, text, text, text, text, integer, bigint, date, integer);
drop function if exists public.nn_restore(text);

-- p_day가 null이면 오늘의 근무 기록은 그대로 둠. 이름·병동·꾸미기는 항상 갱신, 복구 코드는 처음 만들 때만 저장
create or replace function public.nn_submit(
  p_id uuid, p_secret text, p_code text, p_nick text, p_ward text, p_look text,
  p_best integer, p_total bigint, p_day date, p_day_best integer, p_stats text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or char_length(p_secret) < 32 then
    raise exception 'bad secret';
  end if;
  insert into nn_scores (id, secret, code, nick, ward, look, best, total, day, day_best, stats)
  values (p_id, p_secret, upper(p_code), p_nick, coalesce(p_ward, ''), coalesce(p_look, ''),
          coalesce(p_best, 0), coalesce(p_total, 0), p_day,
          case when p_day is null then 0 else coalesce(p_day_best, 0) end, coalesce(p_stats, ''))
  on conflict (id) do update set
    stats = case when coalesce(excluded.stats, '') = '' then nn_scores.stats else excluded.stats end,
    nick  = excluded.nick,
    ward  = excluded.ward,
    look  = excluded.look,
    best  = greatest(nn_scores.best, excluded.best),
    total = greatest(nn_scores.total, excluded.total),
    at    = case when excluded.best > nn_scores.best then now() else nn_scores.at end,
    day   = case when excluded.day is null then nn_scores.day
                 when nn_scores.day is null or excluded.day > nn_scores.day then excluded.day
                 else nn_scores.day end,
    day_best = case when excluded.day is null then nn_scores.day_best
                    when nn_scores.day is null or excluded.day > nn_scores.day then excluded.day_best
                    when excluded.day = nn_scores.day then greatest(nn_scores.day_best, excluded.day_best)
                    else nn_scores.day_best end
  where nn_scores.secret = excluded.secret;
end;
$$;
revoke all on function public.nn_submit(uuid, text, text, text, text, text, integer, bigint, date, integer, text) from public;
grant execute on function public.nn_submit(uuid, text, text, text, text, text, integer, bigint, date, integer, text) to anon, authenticated;

-- 복구 코드로 내 줄 되찾기. 마구 넣어 보기를 늦추려고 0.5초 쉼
create or replace function public.nn_restore(p_code text)
returns table (id uuid, secret text, code text, nick text, ward text, look text, best integer, total bigint, stats text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_sleep(0.5);
  return query
    select s.id, s.secret, s.code, s.nick, s.ward, s.look, s.best, s.total, s.stats
    from nn_scores s
    where s.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
end;
$$;
revoke all on function public.nn_restore(text) from public;
grant execute on function public.nn_restore(text) to anon, authenticated;

-- ============================================================
-- 채팅: 누구나 읽기, 보내기는 nn_post_chat 함수로만 (40자, 기기당 3초에 1번, 최근 100개만 보관)
-- ============================================================
create table if not exists public.nn_chat (
  id    bigint generated always as identity primary key,
  uid   uuid not null,
  nick  text not null check (char_length(nick) between 1 and 5),
  look  text not null default '' check (char_length(look) <= 40),
  text  text not null check (char_length(text) between 1 and 40),
  at    timestamptz not null default now()
);
create index if not exists nn_chat_uid_at on public.nn_chat (uid, at desc);

alter table public.nn_chat enable row level security;
drop policy if exists "모두 읽기" on public.nn_chat;
create policy "모두 읽기" on public.nn_chat for select to anon, authenticated using (true);
revoke all on public.nn_chat from anon, authenticated;
grant select on public.nn_chat to anon, authenticated;

-- 보낸 사람 확인: 랭킹 표의 같은 id·비밀값 (이름을 정할 때 줄이 만들어짐)
create or replace function public.nn_post_chat(
  p_id uuid, p_secret text, p_nick text, p_look text, p_text text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_last timestamptz;
begin
  p_text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  if char_length(p_text) < 1 or char_length(p_text) > 40 then
    raise exception 'bad text';
  end if;
  select secret into v_secret from nn_scores where id = p_id;
  if v_secret is null or v_secret <> p_secret then
    raise exception 'bad secret';
  end if;
  select max(at) into v_last from nn_chat where uid = p_id;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'too fast';
  end if;
  insert into nn_chat (uid, nick, look, text) values (p_id, p_nick, coalesce(p_look, ''), p_text);
  delete from nn_chat where id <= (select id from nn_chat order by id desc offset 100 limit 1);
end;
$$;
revoke all on function public.nn_post_chat(uuid, text, text, text, text) from public;
grant execute on function public.nn_post_chat(uuid, text, text, text, text) to anon, authenticated;
