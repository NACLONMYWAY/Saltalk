export const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation (
  id         TEXT PRIMARY KEY,
  topic      TEXT NOT NULL,
  level      TEXT NOT NULL,
  title      TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sentence (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  speaker         TEXT NOT NULL,
  english         TEXT NOT NULL,
  chinese         TEXT NOT NULL,
  audio_path      TEXT,
  slow_audio_path TEXT,
  tts_status      TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS word (
  id               TEXT PRIMARY KEY,
  word             TEXT NOT NULL,
  meaning          TEXT,
  phonetic         TEXT,
  example          TEXT,
  example_translation TEXT,
  source_sentence_id TEXT,
  added_at         INTEGER NOT NULL,
  review_count     INTEGER DEFAULT 0,
  next_review_at   INTEGER NOT NULL,
  status           TEXT DEFAULT 'learning'
);

CREATE INDEX IF NOT EXISTS idx_sentence_conversation ON sentence(conversation_id, seq);
CREATE INDEX IF NOT EXISTS idx_word_next_review ON word(next_review_at);
`
