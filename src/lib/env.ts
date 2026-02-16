function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000",
};
