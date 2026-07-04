-- V3.9 : Ajout du moyen de paiement sur les transactions
alter table transactions
  add column if not exists payment_method text
  check (payment_method in ('carte', 'especes', 'cheque', 'prelevement', 'virement', 'ticket_resto', 'autre'));

create index if not exists idx_tx_paymethod on transactions(user_id, payment_method);
