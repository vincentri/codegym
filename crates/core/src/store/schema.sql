-- CodeGym local database, version 1. Timestamps are UTC RFC 3339 strings.

CREATE TABLE problems (
  id              TEXT PRIMARY KEY,
  position        INTEGER NOT NULL,
  title           TEXT NOT NULL,
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  description_md  TEXT NOT NULL,
  constraints_json TEXT NOT NULL DEFAULT '[]',
  hints_json      TEXT NOT NULL DEFAULT '[]',
  signature_json  TEXT NOT NULL,
  comparator      TEXT NOT NULL,
  in_place_arg    INTEGER,
  origin          TEXT NOT NULL CHECK (origin IN ('builtin', 'manual', 'ai_imported', 'ai_generated')),
  forked_from     TEXT,
  bank_version    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE test_cases (
  problem_id    TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  idx           INTEGER NOT NULL,
  input_json    TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (problem_id, idx)
);

CREATE TABLE reference_solutions (
  problem_id  TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language    TEXT NOT NULL,
  code        TEXT NOT NULL,
  verified_at TEXT,
  PRIMARY KEY (problem_id, language)
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'slate',
  description TEXT NOT NULL DEFAULT '',
  builtin     INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX categories_name ON categories(name COLLATE NOCASE);

CREATE TABLE problem_categories (
  problem_id  TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, category_id)
);

CREATE TABLE problem_prefs (
  problem_id TEXT PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
  hidden     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE progress (
  problem_id      TEXT PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('todo', 'attempted', 'solved')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  first_solved_at TEXT
);

CREATE TABLE submissions (
  id         TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language   TEXT NOT NULL,
  code       TEXT NOT NULL,
  verdict    TEXT NOT NULL,
  passed     INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  runtime_ms REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX submissions_problem ON submissions(problem_id, created_at);

CREATE TABLE drafts (
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language   TEXT NOT NULL,
  code       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (problem_id, language)
);

CREATE TABLE chat_messages (
  id         TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  mode       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX chat_messages_problem ON chat_messages(problem_id, created_at);

-- Gamification-ready records: one row per accepted submission.
CREATE TABLE solves (
  id                    TEXT PRIMARY KEY,
  problem_id            TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language              TEXT NOT NULL,
  submission_id         TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  difficulty            TEXT NOT NULL,
  solved_at             TEXT NOT NULL,
  time_spent_sec        INTEGER NOT NULL,
  attempts_before_solve INTEGER NOT NULL,
  hints_used            INTEGER NOT NULL,
  solution_revealed     INTEGER NOT NULL,
  runtime_ms            REAL,
  is_first_solve        INTEGER NOT NULL
);

CREATE TABLE practice_sessions (
  id         TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  active_sec INTEGER NOT NULL DEFAULT 0
);

-- Append-only activity log (run, submit, solved, hint_used, ...).
CREATE TABLE activity_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL,
  type         TEXT NOT NULL,
  problem_id   TEXT,
  language     TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX activity_events_ts ON activity_events(ts);

CREATE TABLE study_plans (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  builtin     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE study_plan_items (
  plan_id    TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  PRIMARY KEY (plan_id, problem_id)
);

CREATE TABLE ai_profiles (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  provider     TEXT NOT NULL,
  base_url     TEXT NOT NULL,
  model        TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  has_api_key  INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
