import type { Sql } from 'postgres';
import type { AccountDirectory } from '../../ports/accounts';

/** Usernames to emails through public.login_email (callable by trusted server code only). */
export function createPostgresAccountDirectory(sql: Sql): AccountDirectory {
  return {
    async emailForUsername(username) {
      const [row] = await sql<{ email: string | null }[]>`select public.login_email(${username}) as email`;
      return row?.email ?? null;
    },
  };
}
