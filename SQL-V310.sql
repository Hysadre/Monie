-- V3.10 : Profils utilisateur (pseudo + thème + avatar)
create table if not exists profiles (
    user_id uuid references auth.users(id) on delete cascade primary key,
    display_name text,
    avatar_emoji text default '🌸',
    theme text default 'rose' check (theme in ('rose','ocean','foret','nuit','sobre')),
    show_emojis boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = user_id);

-- Trigger updated_at
create or replace function set_updated_at_profiles()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated on profiles;
create trigger profiles_updated before update on profiles
    for each row execute function set_updated_at_profiles();
