import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export interface UserProfileInput {
  uid: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export async function getOrCreateUser(input: UserProfileInput) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: input.email,
        fullName: input.fullName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        credits: 0,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.email,
          fullName: input.fullName ?? sql`${users.fullName}`,
          avatarUrl: input.avatarUrl ?? sql`${users.avatarUrl}`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user profile.', { cause: error });
  }
}

export async function updateUserDisplayName(userId: number, fullName: string) {
  try {
    const [updated] = await db
      .update(users)
      .set({
        fullName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in updateUserDisplayName:', error);
    throw new Error('Failed to update profile name.', { cause: error });
  }
}
