ALTER TABLE public.investment_holdings
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'THB'
  CHECK (currency IN ('THB', 'USD'));
