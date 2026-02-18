CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" varchar(255) PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "window_start" timestamp with time zone NOT NULL DEFAULT now()
);
