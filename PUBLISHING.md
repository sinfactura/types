# Publishing `sinfactura-types`

How a change to a shared contract reaches every consumer without breaking
their builds. Read this before landing any change that adds, renames, or
reshapes an exported type.

## Consumers

Any repo that imports `sinfactura-types` must stay green against a new release:

| Repo                                               | Channel              |
| -------------------------------------------------- | -------------------- |
| [`sinfactura/api`](https://github.com/sinfactura/api)         | git `dist` branch    |
| [`sinfactura/app`](https://github.com/sinfactura/app)         | git `dist` branch    |
| [`sinfactura/web`](https://github.com/sinfactura/web)         | git `dist` branch    |
| [`sinfactura/landing`](https://github.com/sinfactura/landing) | git `dist` branch    |

> **Ownership.** `api/` is the canonical author of schema-shaped contracts
> (DynamoDB entities, REST/WSS wire shapes, event unions). `app`, `web`, and
> `landing` are consumers only — they file an issue here rather than editing
> `src/` directly. See the monorepo root `CLAUDE.md`.

## Distribution channels

Two channels exist; the git `dist` branch is the live one.

### git `dist` branch (primary)

Consumers pin `github:sinfactura/types#dist` in `package.json`. The
[`build-dist`](.github/workflows/build-dist.yml) GitHub Actions workflow runs
on every push to `main`, compiles `src/` → `dist/`, and force-pushes an orphan
commit to the `dist` branch. No version bump or npm publish is required for
consumers on this channel.

Consumers pull a new build explicitly (git branch refs are **not**
re-resolved by a plain `yarn install`):

```bash
yarn up "sinfactura-types@github:sinfactura/types#dist"   # re-pins the lockfile
```

### npm (live for `api` — automated)

The `api` repo pins the npm registry version (e.g. `^1.6.39`), so npm is a
**live** channel, not just historical. Publishing is automated: the
[`publish-npm`](.github/workflows/publish-npm.yml) workflow runs on every
push to `main` and publishes whenever `package.json`'s `version` isn't on the
registry yet — i.e. exactly the `chore(release): X.Y.Z` bump commits; pushes
without a bump are skipped, not failed. So the release flow is just:

```bash
npm version patch --no-git-tag-version   # or the `release` script's bump half
git commit -am "chore(release): X.Y.Z" && git push   # CI publishes
```

Auth is **npm Trusted Publishing (OIDC)** — no token secret to store or
rotate, provenance attached automatically. One-time setup on npmjs.com
(package `sinfactura-types` → Settings → Publishing access / Trusted
Publisher): add a **GitHub Actions** publisher with organization
`sinfactura`, repository `types`, workflow filename `publish-npm.yml` (no
environment). Recommended: set publishing access to "Require two-factor
authentication or a trusted publisher" so local manual publishes still work
with 2FA while CI publishes via OIDC.

Manual publishes remain possible for special cases:

```bash
# from a clean main, working tree clean:
npm publish                       # publishes the current package.json version
npm publish --tag next            # prerelease channel for in-progress work
```

`sinfactura-types@next` lets a paired consumer PR test an unreleased contract
without promoting it to `latest`. Promote with `npm dist-tag add
sinfactura-types@<version> latest` once both sides are green.

## When to bump the version

Bump `package.json` `version` whenever exported types change:

| Change                                              | Bump      |
| --------------------------------------------------- | --------- |
| Removed field, renamed type, narrowed/changed type  | **major** |
| New type, new optional field, new union member      | **minor** |
| Doc/comment fix, no shape change                    | **patch** |

> **Project convention (overrides semver default):** additive, backward-compatible
> changes ship as **patch** bumps in this repo, not minor — keep the diff small and
> let consumers pull on their own cadence. Reserve minor/major for genuinely
> breaking reshapes.

## PR / commit checklist

- [ ] New types exported from `src/index.ts` (a file not in the barrel is dead).
- [ ] `yarn build` (`tsc`) is green — no TypeScript errors.
- [ ] `package.json` `version` bumped per the table above.
- [ ] `CHANGELOG.md` updated with a one-line entry for the new version.
- [ ] Breaking changes: deprecate first (`@deprecated`), document the migration,
      and coordinate a paired consumer PR (`api` + `app` at minimum) before the
      major lands.
- [ ] Consumers verified green against the new version — locally via
      `sinfactura-types@next` / a `yarn link`, or on the consumer's CI.

## Coordinated cross-repo rollout

When a contract change must land in lockstep with a consumer (e.g. the
subscription types + their `api` handlers):

1. Land the type change here; let `build-dist` publish to `dist` (or
   `npm publish --tag next` for the npm channel).
2. Open the paired consumer PR(s) and point them at the new `dist` commit
   (`yarn up`) or `@next` tag.
3. Merge consumers once green. Promote `@next` → `latest` if using npm.

First cross-cutting use case: the subscription feature
(`sinfactura/app#710` + `sinfactura/api#626`).
