// Push-notification device registry — one row per (user, install), written by
// `POST /devices` and read by the push delivery path.
//
// ⚠️ NAMED `PushDevice*`, never `Device*` or anything carrying `deviceToken`.
// `AuthUser.deviceToken` already exists and is the TRUSTED-DEVICE second-factor
// bypass — the credential that lets a login skip the TOTP prompt. The two are
// unrelated, and the near-collision has already caused one lane to be told to
// reuse the wrong contract. The `Push` prefix is the guard.

declare global {
  /**
   * The channel a token belongs to.
   *
   * ⚠️ `'web'` is FCM, not Expo, and shares this registry deliberately — web
   * push and mobile push are two channels of one delivery system. A contract
   * that assumed Expo everywhere would have to be broken to admit it.
   */
  type PushDevicePlatform = 'ios' | 'android' | 'web';

  /**
   * The stored row. `PK: USER#{storeId}#{userId}`, `SK: DEVICE#{deviceId}`, on
   * the OPERATIONAL table alongside SOCKET/NOTIF — not the main table.
   *
   * ⚠️ `userId` is per-store auto-incremented and NOT globally unique, which is
   * why the store is in the partition key. `USER#{userId}` alone collides across
   * tenants.
   */
  interface PushDevice {
    storeId: string;
    userId: string;
    /**
     * Stable per install, supplied by the client and used verbatim in the SK.
     *
     * ⚠️ Client-controlled key material: bound its length and charset at the
     * edge before it reaches a key expression.
     */
    deviceId: string;
    /**
     * ⚠️ A CREDENTIAL — anyone holding it can push to that device. Treated like
     * a token at rest: never in a log line, a Sentry event, the DDB `ERROR`
     * partition, an export, or any response body. It is deliberately absent from
     * {@link PushDeviceSummary}, which is what every read surface returns.
     *
     * Opaque `string` on purpose. Expo's own format
     * (`ExponentPushToken[…]`) applies to `ios`/`android` only; an FCM web token
     * has a different shape, so pinning Expo's format in the CONTRACT would make
     * it wrong for the `'web'` channel above. Format is validated per platform at
     * the edge, where it can vary.
     */
    pushToken: string;
    platform: PushDevicePlatform;
    /**
     * `false` after a delivery failure that is not conclusive. A conclusive
     * `DeviceNotRegistered` / `UNREGISTERED` receipt hard-DELETES the row instead
     * — absence and `active: false` mean different things, so do not collapse them.
     */
    active: boolean;
    /** Client build, for triaging a platform-specific delivery failure. */
    appVersion?: string;
    createdAt: number;
    updatedAt: number;
  }

  /**
   * What every read surface returns: {@link PushDevice} minus the credential.
   *
   * ⚠️ An ALLOW-list, not the row with a key deleted. The repo has already been
   * bitten by deny-list projections over rows that embed live secrets; a field
   * added to `PushDevice` later must not appear here by default.
   */
  interface PushDeviceSummary {
    deviceId: string;
    platform: PushDevicePlatform;
    active: boolean;
    appVersion?: string;
    createdAt: number;
    updatedAt: number;
  }

  /** `POST /devices` — register or upsert this install's token. */
  interface PushDeviceRegisterBody {
    deviceId: string;
    pushToken: string;
    platform: PushDevicePlatform;
    appVersion?: string;
  }

  /** `POST /devices` → the upserted device, without its token. */
  interface PushDeviceRegisterResponse {
    message: string;
    data: PushDeviceSummary;
  }

  /** `GET /devices` → this user's registered installs in this store, tokens omitted. */
  interface PushDeviceListResponse {
    message: string;
    data: PushDeviceSummary[];
  }

  /** `DELETE /devices/{deviceId}` → the id that was removed. */
  interface PushDeviceDeleteResponse {
    message: string;
    data: { deviceId: string };
  }
}

export {}; // NOSONAR
