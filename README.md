# `sinfactura-types`

> **This repository is archived. The package is not.**
>
> `sinfactura-types` is still published, still public, still MIT. Only the source moved.

Shared TypeScript wire and entity contracts for the SINFACTURA platform — the shapes the
backend, the admin UI, the storefront and the mobile app agree on for users, stores,
customers, products, orders, invoices, baskets, notifications and the rest.

## Where it lives now

The source moved into the repository that owns the contracts, and is maintained there
privately. The package is built and published from that repository's CI on every change to
the contract source; this repository no longer builds, publishes, or accepts changes.

Its workflows are disabled rather than deleted, so the history of how the package used to be
published stays readable.

## What did not change

| | |
| --- | --- |
| Package name | `sinfactura-types` |
| Registry | [npmjs.com/package/sinfactura-types](https://www.npmjs.com/package/sinfactura-types) |
| Visibility | public |
| Licence | MIT |
| Versioning | **next patch, always** — consumers pin exact versions, so semver signalling buys nothing and a too-high version poisons the `latest` line |
| `dist-tags.latest` | continues unbroken from `1.10.233`, the last release published from here |

Install exactly as before:

```bash
npm install sinfactura-types
```

## What did change

**Provenance attestations stop as of `1.10.234`.** npm does not generate provenance for a
package published from a **private** repository, even when the package itself is public and
even under trusted publishing — and it does not fail the publish either, so the attestation
simply stops existing. Releases up to `1.10.233` published from here carry one; later
releases do not. This is a known npm limitation, accepted deliberately, and is not a sign of
a compromised or unofficial release.

**The `dist` branch is frozen.** It was an alternative consumption route that no consumer
used — every consumer pins an exact npm version rather than a git ref. Do not install from
it; it will not be updated again.

## Issues

Closed with the archive. Two open contract requests were relocated to the owning
repository's tracker before archiving, so nothing was left behind here — an archived
repository is read-only, and an issue left open in one can never be answered.
