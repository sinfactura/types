
declare global {
	/**
	 * A pending invitation for a new user to join an existing store's team.
	 *
	 * Stored under `PK: INVITATION#${storeId}`. The row is the ONLY record of
	 * the invite; there is no shadow `User` row until acceptance, so an
	 * unaccepted invite consumes no seat against `maxUsers`.
	 */
	interface Invitation {
		storeId: string;
		invitationId: string;
		/** Invitee's address. Lowercased on write — the uniqueness check is case-insensitive. */
		email: string;
		/** Role the invitee receives on acceptance. Never escalates past the inviter's own. */
		role: string;
		/** `userId` of the team member who issued the invite. */
		invitedBy: string;
		/**
		 * ⚠️ `'expired'` is NEVER persisted — it is derived at read time from
		 * `expiresAt` against now. A stored row only ever carries `'pending'`,
		 * `'accepted'` or `'revoked'`, so a reader that switches on the stored
		 * value must treat an elapsed `'pending'` as expired itself.
		 */
		status: InvitationStatus;
		createdAt: number;
		/** Unix ms after which the invite no longer accepts. Read-time expiry authority. */
		expiresAt: number;
		/**
		 * DynamoDB TTL — Unix **SECONDS**, unlike every other timestamp on this
		 * row. Set beyond `expiresAt` so an expired-but-unreaped invite still
		 * answers `verify` with a truthful reason rather than 404-ing as absent.
		 */
		ttl: number;
		/** Unix ms of acceptance. Absent while `status` is `'pending'` or `'revoked'`. */
		acceptedAt?: number;
		/** `userId` created by acceptance. Set together with `acceptedAt`. */
		acceptedUserId?: string;
		/** Optional free-text note from the inviter, surfaced in the invite email. */
		message?: string;
		/**
		 * SHA-256 of the invite token. The plaintext token is emailed once and
		 * never stored. Named to match `response()`'s auto-strip list, so it
		 * cannot reach the wire through an unprojected read.
		 */
		hashedToken?: string;
		/**
		 * Lowercase WRITE-SIDE index for backend filtering. Internal — not part
		 * of the read contract; never consume it.
		 */
		search?: string;
	}

	/** `'expired'` is derived at read time and never persisted — see `Invitation.status`. */
	type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

	/** `POST /invitations` request body. */
	interface CreateInvitationInput {
		email: string;
		role: string;
		message?: string;
	}
}

export {}; // NOSONAR
