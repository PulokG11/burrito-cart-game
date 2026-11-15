-- 001_init: scenario content, players, sessions, day results, championships, leaderboard (TADD §4).

CREATE TABLE scenario (
  scenario_id   text PRIMARY KEY,
  version       text NOT NULL,
  mode          text NOT NULL CHECK (mode IN ('normal', 'championship')),
  round         smallint NOT NULL CHECK (round IN (1, 2)),
  day           smallint NOT NULL CHECK (day BETWEEN 1 AND 5),
  title         text NOT NULL,
  news_text     text NOT NULL,
  wrinkle       text NOT NULL,
  revenue_r     numeric(10,2) NOT NULL CHECK (revenue_r > 0),
  ingredient_k  numeric(10,2) NOT NULL CHECK (ingredient_k >= 0),
  truck_cost_f  numeric(10,2) NOT NULL CHECK (truck_cost_f >= 0),
  walk_plateau  numeric(6,2) NOT NULL,
  walk_max      numeric(6,2) NOT NULL CHECK (walk_max > walk_plateau),
  is_uncertain  boolean NOT NULL DEFAULT false,
  content_hash  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version, mode, round, day)
);

-- Round 1: demand is exact. Round 2: demand is the forecast (mode) and err_min/err_max are the error bars.
CREATE TABLE scenario_building (
  scenario_id  text NOT NULL REFERENCES scenario ON DELETE CASCADE,
  building_id  text NOT NULL,
  name         text NOT NULL,
  x            numeric(6,2) NOT NULL,
  y            numeric(6,2) NOT NULL,
  demand       integer NOT NULL CHECK (demand >= 0),
  err_min      integer,
  err_max      integer,
  PRIMARY KEY (scenario_id, building_id),
  CHECK ((err_min IS NULL AND err_max IS NULL) OR (err_min >= 0 AND err_min <= demand AND demand <= err_max))
);

CREATE TABLE scenario_site (
  scenario_id  text NOT NULL REFERENCES scenario ON DELETE CASCADE,
  site_id      text NOT NULL,
  x            numeric(6,2) NOT NULL,
  y            numeric(6,2) NOT NULL,
  PRIMARY KEY (scenario_id, site_id)
);

CREATE TABLE scenario_reach (
  scenario_id  text NOT NULL,
  building_id  text NOT NULL,
  site_id      text NOT NULL,
  distance     numeric(7,3) NOT NULL,
  alpha        numeric(5,3) NOT NULL CHECK (alpha > 0 AND alpha <= 1),
  PRIMARY KEY (scenario_id, building_id, site_id),
  FOREIGN KEY (scenario_id, building_id) REFERENCES scenario_building ON DELETE CASCADE,
  FOREIGN KEY (scenario_id, site_id) REFERENCES scenario_site ON DELETE CASCADE
);

-- Pre-solved optimum on expected demand (ADR-03); greedy is cached for the algorithm-hint tip.
CREATE TABLE optimal_solution (
  scenario_id     text PRIMARY KEY REFERENCES scenario ON DELETE CASCADE,
  content_hash    text NOT NULL,
  open_sites      text[] NOT NULL,
  planned_profit  numeric(12,2) NOT NULL,
  greedy_sites    text[] NOT NULL,
  greedy_profit   numeric(12,2) NOT NULL,
  solver          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE player (
  player_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 24),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE championship (
  match_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(19) NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9]{1,19}$'),
  organizer_id  uuid NOT NULL REFERENCES player,
  seed          text NOT NULL,
  dataset_ver   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE TABLE game_session (
  session_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid NOT NULL REFERENCES player,
  match_id       uuid REFERENCES championship,
  dataset_ver    text NOT NULL,
  seed           text NOT NULL,
  token_hash     text NOT NULL,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  days_played    smallint NOT NULL DEFAULT 0,
  total_profit   numeric(12,2) NOT NULL DEFAULT 0,
  total_optimal  numeric(12,2) NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

-- Written once per day at submit; the primary key makes a resubmit idempotent.
CREATE TABLE day_result (
  session_id       uuid NOT NULL REFERENCES game_session ON DELETE CASCADE,
  scenario_id      text NOT NULL REFERENCES scenario,
  open_sites       text[] NOT NULL,
  actual_demand    jsonb NOT NULL,
  revenue          numeric(12,2) NOT NULL,
  ingredient_cost  numeric(12,2) NOT NULL,
  truck_cost       numeric(12,2) NOT NULL,
  profit           numeric(12,2) NOT NULL,
  optimal_profit   numeric(12,2) NOT NULL,
  gap_pct          numeric(7,2) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, scenario_id)
);

CREATE TABLE leaderboard_entry (
  entry_id       bigserial PRIMARY KEY,
  session_id     uuid NOT NULL UNIQUE REFERENCES game_session ON DELETE CASCADE,
  match_id       uuid REFERENCES championship,
  display_name   text NOT NULL,
  total_profit   numeric(12,2) NOT NULL,
  total_optimal  numeric(12,2) NOT NULL,
  efficiency     numeric(7,2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leaderboard_normal_idx ON leaderboard_entry (efficiency DESC, created_at) WHERE match_id IS NULL;
CREATE INDEX leaderboard_match_idx ON leaderboard_entry (match_id, total_profit DESC) WHERE match_id IS NOT NULL;
CREATE INDEX game_session_player_idx ON game_session (player_id);
