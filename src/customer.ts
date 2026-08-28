declare global {
  interface CustomerAfip {
    cuit: string;
    razonSocial: string;
    condFiscal: number;
    condFiscalName: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
  }

  interface CustomerMarketing {
    adds?: boolean;
    email?: boolean;
    phone?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
  }

  /** Write shape for customer create/update — carries the transient photo controls. */
  type CustomerUpsertInput = Partial<Customer> & PhotoUploadControls;

  interface Customer {
    storeId: string;
    customerId: string;
    address: string;
    afip: CustomerAfip[];
    balance?: number;
    city: string;
    createdAt: number;
    cuit: string;
    /**
     * FK into `Store.deliveryMethods`. OPTIONAL, because `POST /customers` has
     * always modelled it that way (`z.number().optional()`) — a customer created
     * through the API can genuinely carry neither this nor `paymentMethod`, and
     * declaring them required made this contract disagree with its own validator.
     * Only the CSV importer and web self-registration supply a value today.
     *
     * ⚠️ Do NOT read it as though it were populated. Resolve it against the
     * store's catalog and tolerate a miss — `find(({ id }) => id === …)?.name ?? ''`
     * — the way the invoice and PDF paths already do. An id here can also be
     * RETIRED: the store reconciler never reissues a removed method id, precisely
     * so a stale reference resolves to nothing rather than to someone else's
     * method.
     *
     * ⚠️ The id carries no meaning. Method ids are per-catalog ORDINALS — the
     * store seed uses id `1` for four different things in four different catalogs
     * — so `deliveryMethod === 1` is not a pickup test.
     */
    deliveryMethod?: number;
    disabled: boolean;
    discount: number;
    email: string;
    /**
     * Set ONLY by the customer OTP verify transaction.
     *
     * ⚠️ UNDEFINED MEANS **NOT** VERIFIED — deliberately the INVERSE of
     * `User.emailVerified`, which carries a grandfather clause telling apps to
     * treat undefined as verified. Do not copy that comment here. Pre-existing
     * customer rows have no attribute and must read as UNVERIFIED; reading
     * absence as verified would silently mark the entire existing customer base
     * verified and defeat the backfill it exists to force.
     */
    emailVerified?: boolean;
    /** ms-epoch of the OTP verification. Absent whenever `emailVerified` is not `true`. */
    emailVerifiedAt?: number;
    favorites?: Partial<Product>[];
    fullName: string;
    /** Storage-only credential hash — stripped from every response by the api's central sanitizer; never present on reads. */
    hash?: string;
    lastBuy?: number;
    lastLog?: number;
    /**
     * Per-account brute-force counter for `POST /auth?mode=login` (web).
     * Mirrors `User.login` exactly. Storage-only — must never leave the API;
     * `sanitizeCustomerRow` strips it at every wire boundary (auth-response
     * legs and `dynamoUpdate`'s write echo).
     */
    login?: {
      failedAttempts?: number;
      lockedUntil?: number;
      lastFailedAt?: number;
    };
    marketing?: CustomerMarketing;
    minBuy?: number;
    /**
     * FK into `Store.paymentMethods`. OPTIONAL for the same reason as
     * `deliveryMethod` above, and with the same reader contract: resolve against
     * the store's catalog and tolerate a miss rather than assuming presence, and
     * do not read the id as semantic.
     */
    paymentMethod?: number;
    phone: string;
    photoURL: string;
    /** @deprecated Request-only upload control, never persisted or returned — use `CustomerUpsertInput.photoData`. */
    photoData?: string;
    /** @deprecated Request-only control, never persisted or returned — use `CustomerUpsertInput.removePhotoURL`. */
    removePhotoURL?: string;
    postalCode: string;
    /**
     * FK to PriceList.id (NOT a positional ordinal). Picks which PriceSlot /
     * materialized priceN applies to this customer. Legacy values 1..4 already
     * equal the seeded list ids, so the migration is value-preserving; getPrice
     * resolves by id, not by `price${ordinal}`.
     */
    priceList: number;
    province: string;
    /** Storage-only credential salt — stripped from every response by the api's central sanitizer; never present on reads. */
    salt?: string;
    /**
     * @deprecated Lowercase WRITE-SIDE index for backend `contains` filtering.
     * Internal — not part of the read contract, even where legacy responses
     * still include it; never consume it.
     */
    search?: string;
    updatedAt?: number;
    /**
     * catalogId — FK to PlatformCurrency.
     *
     * DISPLAY / PRICING preference only: which currency this customer
     * views and transacts in (load-bearing in storefront pricing + the
     * DNI/CUIT checkout gate). It is NOT a ledger denomination and is
     * pure passenger data server-side. MUST NOT be used to infer the
     * denomination of unstamped `ACCOUNT` rows — doing so is the root
     * cause of the denomination bug. Unstamped ledger rows fall back to
     * `store.config.displayCurrency`, never to this field.
     */
    currencyId?: string;
    deliveryAddress?: {
      fullName: string;
      address: string;
      phone: string;
      city: string;
      province: string;
      postalCode: string;
    };
  }

  /**
   * A stored `Customer` plus the session tokens. Same caveat as `AuthUser`:
   * the storefront login body is SANITIZED, so the brute-force `login`
   * counters and the write-side `search` index are dropped before it leaves
   * the Lambda and `salt` is stripped centrally — an inherited field declared
   * here is not by itself evidence that it arrives.
   */
  interface AuthCustomer extends Customer {
    accessToken: string;
    /**
     * ⚠️ Transport-conditional, exactly as `AuthUser.refreshToken`: present
     * in the body only under the body refresh transport, and absent under the
     * default cookie transport, which is what every browser session uses. It
     * reads `undefined` there with nothing thrown, because the HttpOnly cookie
     * carries the session instead.
     */
    refreshToken?: string;
  }
}

export {}; // NOSONAR