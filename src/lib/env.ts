function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in .env.local (dev) or Vercel dashboard (prod).`
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXT_PUBLIC_URL: optionalEnv("NEXT_PUBLIC_URL", "http://localhost:3000"),
};
