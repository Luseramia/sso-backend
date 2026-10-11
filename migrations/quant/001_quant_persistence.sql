-- Additive, independent migration: deliberately does not run the legacy migration queue.
CREATE TABLE IF NOT EXISTS quant_market_snapshots (
  id uuid PRIMARY KEY,
  owner_id integer NOT NULL CHECK (owner_id > 0),
  provider varchar(30) NOT NULL DEFAULT 'twelvedata',
  symbol varchar(15) NOT NULL,
  exchange varchar(80) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  interval varchar(10) NOT NULL DEFAULT '1day',
  adjustment varchar(10) NOT NULL DEFAULT 'all',
  requested_count integer NOT NULL CHECK (requested_count BETWEEN 100 AND 2000),
  row_count integer NOT NULL CHECK (row_count BETWEEN 60 AND 2000),
  cutoff_date date NOT NULL,
  fingerprint varchar(64) NOT NULL,
  fetched_at timestamptz NOT NULL,
  checked_at timestamptz NOT NULL,
  CONSTRAINT quant_snapshot_owner_id_uq UNIQUE (owner_id, id),
  CONSTRAINT quant_snapshot_owner_fingerprint_uq UNIQUE (owner_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS quant_snapshot_cache_idx
  ON quant_market_snapshots(owner_id, symbol, requested_count, cutoff_date, checked_at);

CREATE TABLE IF NOT EXISTS quant_daily_prices (
  snapshot_id uuid NOT NULL REFERENCES quant_market_snapshots(id),
  date date NOT NULL,
  open numeric(30,11) NOT NULL CHECK (open > 0),
  close numeric(30,11) NOT NULL CHECK (close > 0),
  PRIMARY KEY (snapshot_id, date)
);

CREATE TABLE IF NOT EXISTS quant_backtest_runs (
  id uuid PRIMARY KEY,
  owner_id integer NOT NULL CHECK (owner_id > 0),
  name varchar(120) NOT NULL,
  snapshot_a_id uuid NOT NULL,
  snapshot_b_id uuid NOT NULL,
  symbol_a varchar(15) NOT NULL,
  symbol_b varchar(15) NOT NULL,
  engine_version varchar(30) NOT NULL,
  settings jsonb NOT NULL,
  result jsonb NOT NULL,
  net_return double precision NOT NULL,
  trade_count integer NOT NULL CHECK (trade_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quant_run_a_owner_fk FOREIGN KEY (owner_id, snapshot_a_id) REFERENCES quant_market_snapshots(owner_id, id),
  CONSTRAINT quant_run_b_owner_fk FOREIGN KEY (owner_id, snapshot_b_id) REFERENCES quant_market_snapshots(owner_id, id)
);
CREATE INDEX IF NOT EXISTS quant_runs_owner_created_idx ON quant_backtest_runs(owner_id, created_at);
