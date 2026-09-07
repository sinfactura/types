// Push-notification device registry — one row per (user, install), written by
// `POST /devices` and read by the push delivery path.
//
// ⚠️ NAMED `PushDevice*`, never `Device*` or anything carrying `deviceToken`.
// `AuthUser.deviceToken` already exists and is the TRUSTED-DEVICE second-factor
// bypass — the credential that lets a login skip the TOTP prompt. The two are
// unrelated, and the near-collision has already caused one lane to be told to
// reuse the wrong contract. The `Push` prefix is the guard.
export {};
