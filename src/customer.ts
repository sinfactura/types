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

  /**
   * Provenance for ONE channel's current consent value.
   *
   * ⚠️ `ip` is PII under Ley 25.326 and is stored deliberately — it is the
   * evidence that makes a consent record defensible, and dropping it weakens
   * the defence. It must never reach a log line, a Sentry event, the DDB
   * `ERROR` partition, an export, or any projection served to a party other
   * than the data subject themselves.
   */
  interface ChannelConsentStamp {
    /** ms epoch of the grant or withdrawal this stamp describes. */
    ts: number;
    source: 'ui' | 'import' | 'api' | 'storefront';
    /** Absent when the write had no request-level IP (a CSV import, a job). */
    ip?: string;
  }

  interface CustomerMarketing {
    adds?: boolean;
    email?: boolean;
    phone?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
    /**
     * Per-channel provenance for the CURRENT boolean above — the latest
     * grant's or withdrawal's source and timestamp.
     *
     * ⚠️ This is NOT a history. It answers "what do we believe right now, and
     * why". The append-only proof of every prior state — what changed, from
     * what to what, when, and by whom — lives in the activity audit trail.
     *
     * ⚠️ Per-CHANNEL deliberately, never one stamp for the whole object: a
     * customer may grant email today and SMS in three months, and a single
     * timestamp would be overwritten by the second grant and could no longer
     * answer when email consent was obtained — the one question a dispute
     * turns on.
     *
     * Absence means the channel is untouched since this field shipped, or the
     * row predates it. Forward-only: never backfilled.
     *
     * ⚠️ Absence NEVER means consent. Every reader must default a missing
     * channel to `false`.
     */
    consent?: Partial<Record<'adds' | 'email' | 'phone' | 'sms' | 'whatsapp', ChannelConsentStamp>>;
    /** Per-customer, not per-channel — one unsubscribe link covers every channel. */
    unsubscribeToken?: string;
  }

  /** Write shape for customer create/update — carries the transient photo controls. */
  type CustomerUpsertInput = Partial<Customer> & PhotoUploadControls;

  /**
   * One unsettled debit on a customer's current account, as denormalised onto
   * the `Customer` row for the accounts report's aging summary.
   *
   * ⚠️ `dated` is a **`YYYYMMDD` CALENDAR INTEGER** (`20260905`) — never an ms
   * epoch, never a string. It matches `getDated()` and the `dated` already
   * written on `ACCOUNT#`/`BALANCE-` rows, so the two agree by construction.
   *
   * ⚠️ **NEVER SUBTRACT TWO OF THESE.** They are decimal-packed calendar
   * fields, so `20260101 - 20251231` is `8870` for two days one apart — an
   * age that lands a one-day-old debit in the most-overdue bucket, which is
   * the one a collections operator acts on hardest. Convert both endpoints to
   * a timestamp first; a fixed-offset conversion applied to both cancels
   * exactly, so whole-day integers come out with nothing to round.
   */
  interface OpenDebit {
    /** `YYYYMMDD` calendar integer — see the warnings above. */
    dated: number;
    amount: number;
  }

  interface Customer {
    storeId: string;
    customerId: string;
    address: string;
    afip: CustomerAfip[];
    balance?: number;
    city: string;
    createdAt: number;
    /**
     * Ceiling on this customer's account `balance`, in the store's display
     * currency (`Store.config.displayCurrency`).
     *
     * ⚠️ ABSENT MEANS NO CEILING — an unlimited account, not a zero one. A
     * reader must not coerce absence to `0`, which would refuse credit to every
     * customer that has never had a limit set.
     */
    creditLimit?: number;
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
    /**
     * The Apple **Hide My Email** relay address this customer signs in with, if
     * they have linked one — `<opaque>@privaterelay.appleid.com`.
     *
     * Apple replaces the `email` claim with a per-app relay, delivered with
     * `email_verified: true`. The relay is STABLE per app, so it never converges
     * on the real address: an identity lookup by `email` alone misses forever,
     * and the customer cannot reach an account they already own.
     *
     * This field is the resolution alias. It is written at explicit LINK time —
     * never silently on first sign-in — and read as a fallback when the primary
     * email lookup misses.
     *
     * ⚠️ **APPLE-SPECIFIC BY NAME, ON PURPOSE.** A provider-neutral
     * "alternate address" would describe the same bytes and lose the constraint:
     * the branch that consumes this MUST be gated on the Apple provider, so that
     * a non-Apple token presenting a `privaterelay.appleid.com` address cannot
     * reach it by spoofing the address alone. Naming it for the provider puts
     * that boundary in the type rather than leaving it to a handler check
     * somebody later "simplifies". Widening this to other providers is a new
     * field and a new security argument, not a rename.
     *
     * ⚠️ **OPTIONAL, and it must stay optional.** This repo is forward-only and
     * never backfills: every customer row written before this shipped has no
     * such attribute, and a required field would misdescribe the entire
     * installed base.
     *
     * ⚠️ **Apple can REVOKE a relay.** A stale value is therefore expected, not
     * exceptional. A consumer that cannot resolve it must degrade to the same
     * refusal an absent value produces — never to resolving a different
     * customer. Absence and staleness are the same answer here: "not resolvable
     * by this address".
     *
     * ⚠️ Not a second contact address. It is a login identity and nothing
     * addresses mail to it; `email` remains the address the customer is written
     * to. Reading this as a mailto target would send to a relay Apple may have
     * already revoked.
     */
    appleRelayEmail?: string;
    favorites?: Partial<Product>[];
    fullName: string;
    /** Storage-only credential hash — stripped from every response by the api's central sanitizer; never present on reads. */
    hash?: string;
    lastBuy?: number;
    lastLog?: number;
    /**
     * ms epoch of the last COLLECTIONS chase, so the accounts report can show
     * it without a per-customer query — the same denormalisation `balance`
     * already makes on this row.
     *
     * ⚠️ Fed ONLY by a `ReminderRecord` with `kind: 'reminder'`. It is
     * therefore absent on every customer until the dunning mode ships, and
     * that is correct rather than missing: populating it from transactional
     * mail would read as "already chased" to a collections operator who would
     * then skip a debtor.
     *
     * ⚠️ A cache of the `REMINDER#{storeId}#{customerId}` rows, never an
     * independent truth. If the two can disagree, the list and the per-customer
     * history show different answers for the same customer.
     */
    lastReminderAt?: number;
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
     * Unsettled debits denormalised onto this row so the accounts report can
     * bucket them by age without a per-customer query — the same
     * denormalisation `balance` and `lastReminderAt` already make here.
     *
     * FIFO-ordered, **oldest first**, so a credit consumes the oldest debt
     * first. Capped; the writer REFUSES at the cap rather than evicting, and
     * sets `openDebitsOverflow`.
     *
     * ⚠️ **Deliberately NOT on `CUSTOMER_OPERATOR_BROADCAST_FIELDS`.** That
     * projection is an allow-list, so this field is absent from the operator
     * WS frame by construction rather than by scrubbing — and it must stay
     * absent. `wsPostStore` also reaches the row's own customer, and a store's
     * collections working-set is the store's posture, not the customer's
     * record: a debtor who can read the bucket edges can time around them.
     * `balance` is on that list as a deliberate exception; this is not.
     *
     * ⚠️ A whole-attribute `SET` here is NOT safe beside the seven atomic
     * `balance` deltas. Those are arithmetic (`ADD balance :add`) precisely so
     * concurrent writers compose; replacing this array wholesale loses updates
     * the arithmetic next to it would have kept.
     */
    openDebits?: OpenDebit[];
    /**
     * The cap was reached and the write was REFUSED, so `openDebits` is not a
     * complete picture of this customer's arrears.
     *
     * ⚠️ Absence means "not overflowed", never "unknown" — but a reader must
     * still not treat a present-and-`false` value as proof the array is
     * complete on a row written before this field existed. Forward-only.
     */
    openDebitsOverflow?: boolean;
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
    /**
     * Stored sign-in identity for this account: which providers may be used,
     * the Firebase UID each was seen under, and when.
     *
     * ⚠️ STORAGE SHAPE, NOT THE READ CONTRACT. This array holds `'refused'`
     * entries as well as `'linked'` ones — it has to, or an unlink undoes
     * itself on the next sign-in (see `CustomerSignInMethodStatus`). The
     * customer-facing read answers with `CustomerSignInMethodsResponse`, whose
     * `methods` is filtered to the LINKED entries. Never hand this attribute to
     * a client verbatim.
     *
     * ⚠️ That is an obligation on the api, not a property it already has. The
     * central CUSTOMER-row sanitizer drops only the brute-force `login` counter
     * and the write-side `search` index, and the auth response legs return a
     * whole customer row — so the first writer of this attribute must also add
     * it to that sanitizer, or every refused entry and every Firebase UID rides
     * out on the login/social/refresh responses, which is precisely the state
     * the read endpoint exists to withhold.
     *
     * ⚠️ ABSENT ON EVERY CUSTOMER THAT EXISTS TODAY, and forward-only writes
     * mean it stays absent until that customer's next social sign-in heals the
     * row. Absence means "not recorded yet", never "no providers" — reading it
     * as an empty provider list is what would lock out the installed base.
     */
    signInMethods?: CustomerSignInMethod[];
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