-- Run this once in the Supabase SQL editor for your project.

create table if not exists leads (
  id bigint generated always as identity primary key,
  trade text not null,
  name text not null,
  address text,
  city text not null,
  phone text,
  rating numeric default 0,
  reviews integer default 0,
  website text,
  hours jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (name, city, trade)
);

create index if not exists leads_created_at_idx on leads (created_at desc);

-- RLS is enabled with no policies, so only the service-role key (used
-- server-side by the api/ functions) can read/write. The anon key,
-- if it were ever exposed, would get nothing.
alter table leads enable row level security;


-- Counties, cities, and trades are user-extensible: anyone using the
-- app can add new ones (via /api/counties, /api/cities, /api/trades),
-- and they become available to everyone since they live here rather
-- than in hardcoded frontend arrays.

create table if not exists counties (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists cities (
  id bigint generated always as identity primary key,
  name text not null,
  county_id bigint not null references counties (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (name, county_id)
);

create table if not exists trades (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table counties enable row level security;
alter table cities enable row level security;
alter table trades enable row level security;

-- Seed with the original hardcoded lists so the app doesn't start empty.

insert into counties (name) values
  ('Contra Costa County'), ('Alameda County'), ('San Francisco County'),
  ('San Mateo County'), ('Santa Clara County'), ('Marin County'),
  ('Sonoma County'), ('Sacramento County'), ('Los Angeles County'), ('Orange County')
on conflict (name) do nothing;

insert into cities (name, county_id)
select v.city, c.id
from (values
  ('Antioch', 'Contra Costa County'), ('Brentwood', 'Contra Costa County'), ('Clayton', 'Contra Costa County'),
  ('Concord', 'Contra Costa County'), ('Danville', 'Contra Costa County'), ('El Cerrito', 'Contra Costa County'),
  ('Hercules', 'Contra Costa County'), ('Lafayette', 'Contra Costa County'), ('Martinez', 'Contra Costa County'),
  ('Moraga', 'Contra Costa County'), ('Oakley', 'Contra Costa County'), ('Orinda', 'Contra Costa County'),
  ('Pinole', 'Contra Costa County'), ('Pittsburg', 'Contra Costa County'), ('Pleasant Hill', 'Contra Costa County'),
  ('Richmond', 'Contra Costa County'), ('San Pablo', 'Contra Costa County'), ('San Ramon', 'Contra Costa County'),
  ('Walnut Creek', 'Contra Costa County'),
  ('Alameda', 'Alameda County'), ('Albany', 'Alameda County'), ('Berkeley', 'Alameda County'),
  ('Castro Valley', 'Alameda County'), ('Dublin', 'Alameda County'), ('Emeryville', 'Alameda County'),
  ('Fremont', 'Alameda County'), ('Hayward', 'Alameda County'), ('Livermore', 'Alameda County'),
  ('Newark', 'Alameda County'), ('Oakland', 'Alameda County'), ('Pleasanton', 'Alameda County'),
  ('San Leandro', 'Alameda County'), ('Union City', 'Alameda County'),
  ('San Francisco', 'San Francisco County'),
  ('Belmont', 'San Mateo County'), ('Burlingame', 'San Mateo County'), ('Daly City', 'San Mateo County'),
  ('Foster City', 'San Mateo County'), ('Menlo Park', 'San Mateo County'), ('Millbrae', 'San Mateo County'),
  ('Pacifica', 'San Mateo County'), ('Redwood City', 'San Mateo County'), ('San Bruno', 'San Mateo County'),
  ('San Mateo', 'San Mateo County'), ('South San Francisco', 'San Mateo County'),
  ('Campbell', 'Santa Clara County'), ('Cupertino', 'Santa Clara County'), ('Gilroy', 'Santa Clara County'),
  ('Los Altos', 'Santa Clara County'), ('Milpitas', 'Santa Clara County'), ('Mountain View', 'Santa Clara County'),
  ('Palo Alto', 'Santa Clara County'), ('San Jose', 'Santa Clara County'), ('Santa Clara', 'Santa Clara County'),
  ('Saratoga', 'Santa Clara County'), ('Sunnyvale', 'Santa Clara County'),
  ('Corte Madera', 'Marin County'), ('Fairfax', 'Marin County'), ('Mill Valley', 'Marin County'),
  ('Novato', 'Marin County'), ('San Rafael', 'Marin County'), ('Tiburon', 'Marin County'),
  ('Cotati', 'Sonoma County'), ('Healdsburg', 'Sonoma County'), ('Petaluma', 'Sonoma County'),
  ('Rohnert Park', 'Sonoma County'), ('Santa Rosa', 'Sonoma County'), ('Sebastopol', 'Sonoma County'),
  ('Windsor', 'Sonoma County'),
  ('Citrus Heights', 'Sacramento County'), ('Elk Grove', 'Sacramento County'), ('Folsom', 'Sacramento County'),
  ('Rancho Cordova', 'Sacramento County'), ('Roseville', 'Sacramento County'), ('Sacramento', 'Sacramento County'),
  ('Alhambra', 'Los Angeles County'), ('Burbank', 'Los Angeles County'), ('Compton', 'Los Angeles County'),
  ('Downey', 'Los Angeles County'), ('El Monte', 'Los Angeles County'), ('Glendale', 'Los Angeles County'),
  ('Inglewood', 'Los Angeles County'), ('Long Beach', 'Los Angeles County'), ('Los Angeles', 'Los Angeles County'),
  ('Pasadena', 'Los Angeles County'), ('Pomona', 'Los Angeles County'), ('Santa Monica', 'Los Angeles County'),
  ('Torrance', 'Los Angeles County'), ('West Covina', 'Los Angeles County'),
  ('Anaheim', 'Orange County'), ('Costa Mesa', 'Orange County'), ('Fullerton', 'Orange County'),
  ('Huntington Beach', 'Orange County'), ('Irvine', 'Orange County'), ('Mission Viejo', 'Orange County'),
  ('Newport Beach', 'Orange County'), ('Orange', 'Orange County'), ('Santa Ana', 'Orange County')
) as v(city, county_name)
join counties c on c.name = v.county_name
on conflict (name, county_id) do nothing;

insert into trades (name) values
  ('Plumber'), ('Electrician'), ('HVAC'), ('Drywall Contractor'), ('General Contractor'),
  ('Roofer'), ('Painter'), ('Landscaper'), ('Concrete Contractor'), ('Flooring Contractor'),
  ('Tile Contractor'), ('Fence Contractor'), ('Handyman'), ('Pool Contractor'), ('Solar Installer')
on conflict (name) do nothing;


-- Countries: the top level above counties, since the app was originally
-- California-only (search.js used to hardcode "CA" on every query).
-- Counties/regions now belong to a country instead of being a flat
-- global list, so the same county name can exist in different countries.

create table if not exists countries (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table countries enable row level security;

insert into countries (name) values ('United States')
on conflict (name) do nothing;

alter table counties add column if not exists country_id bigint references countries (id) on delete cascade;

update counties set country_id = (select id from countries where name = 'United States')
where country_id is null;

alter table counties alter column country_id set not null;

alter table counties drop constraint if exists counties_name_key;
alter table counties drop constraint if exists counties_name_country_id_key;
alter table counties add constraint counties_name_country_id_key unique (name, country_id);
