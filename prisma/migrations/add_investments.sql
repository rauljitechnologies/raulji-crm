-- Direct investments / capital added to a company
CREATE TABLE IF NOT EXISTS investments (
  investment_id       text PRIMARY KEY,
  company_id          text NOT NULL REFERENCES companies(company_id),
  date                timestamp(3) NOT NULL,
  amount              double precision NOT NULL,
  source              text NOT NULL,
  type                text NOT NULL DEFAULT 'OWNER_FUNDS',
  notes               text,
  created_by_user_id  text REFERENCES users(user_id),
  created_at          timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS investments_company_id_date_idx ON investments (company_id, date);
