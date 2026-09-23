# Running AroundU in Jenkins

This document is the companion to the `Jenkinsfile` at the repo root. It covers what caused the
original build failures, what was fixed, what you need installed on the Jenkins agent, and how to
point the build at your company's PostgreSQL/Eureka instead of the local defaults - without ever
editing a source file to do it.

## What was actually breaking the build

Two unrelated things were happening at once:

1. **Real compilation errors.** A large batch of manually/externally-applied fixes had been
   merged into the working tree, and several of its files had been rewritten independently of
   code elsewhere in the repo that depended on them - so some things that compiled in isolation
   didn't compile together. This has been fixed; every one of the 8 backend Maven modules and the
   Angular frontend now compiles, test-compiles, and builds cleanly (see the commit that
   introduced this document for the full list of what was repaired).

2. **The actual "TCS proxy won't let us download fonts from Google" problem.** The frontend was
   loading three fonts from `fonts.googleapis.com` (Inter) and `fonts.gstatic.com`/
   `fonts.googleapis.com` again (Outfit, Plus Jakarta Sans) via a CSS `@import` and `<link>` tags
   in `index.html`, plus loading Font Awesome's icon set from `cdnjs.cloudflare.com`. A corporate
   proxy that only allowlists package-registry domains (npm, Maven Central/your internal mirror)
   and blocks general CDN/font hosts will break this - not the `npm`/`mvn` build step itself, but
   the running app in the browser, and any headless-browser test run (`ng test`) that tries to
   render a real page.

   **This is fixed by removing the dependency entirely, not by working around it:**
   - Inter/Outfit/Plus Jakarta Sans are now vendored as three small variable-weight `.woff2` files
     under `frontend/src/assets/fonts/`, referenced via local `@font-face` rules in
     `frontend/src/styles.scss`.
   - Font Awesome is now an npm dependency (`@fortawesome/fontawesome-free`, pinned to `6.5.2` -
     the same version the old CDN link used) instead of a CDN import; its icon font files are
     copied into the build output via a new asset entry in `angular.json`.
   - `frontend/src/index.html` no longer has any `fonts.googleapis.com`/`fonts.gstatic.com`
     `<link>` tags at all.

   After this change, the frontend build and the running app need **zero** network access to
   Google Fonts or cdnjs, ever. The only external hosts anything in this repo still needs are your
   package registries (see "Prerequisites" below) - and if your organization mirrors those
   internally, even that goes away.

## Prerequisites on the Jenkins agent

| Tool | Version | Why |
|---|---|---|
| JDK | 17 | All 8 backend services target Java 17. No separate Maven install is needed - each module carries its own Maven Wrapper (`mvnw`/`mvnw.cmd`), which downloads the pinned Maven version itself on first use. |
| Node.js | 20.x (or whatever `frontend/package.json`'s `engines` field specifies, if present) | Angular CLI build. |
| npm | ships with Node | `npm ci` for a reproducible install from `package-lock.json`. |
| Git | any recent version | Jenkins SCM checkout. |

Nothing else needs to be pre-installed - no Chrome/Chromium (the pipeline's `RUN_FRONTEND_UNIT_TESTS`
parameter is off by default specifically because `ng test` needs a real or headless browser binary
that most build agents don't have; turn it on only if you've installed one), no PostgreSQL, no
Eureka. Unit tests across every backend module run against an in-memory H2 database (see each
module's `src/test/resources/application-test.properties`) - a live Postgres/Eureka is only needed
to actually *run* the services afterward, not to build or test them.

## Setting up the Jenkins job

1. Create a **Pipeline** project (matches what you already have).
2. Under **Pipeline**, choose **Pipeline script from SCM**, point it at this repository and
   branch, and leave the script path as `Jenkinsfile` (the default).
3. That's it - no other Jenkins-side scripting, shared library, or Groovy is required. Every
   stage lives in the committed `Jenkinsfile`.

The pipeline has two build parameters you can leave at their defaults or override per-run:

- **`RUN_FRONTEND_UNIT_TESTS`** (default off) - only turn on if the agent has a Chrome/Chromium
  binary available.
- **`FAIL_ON_TEST_FAILURES`** (default off) - see "Known pre-existing test failures" below for
  why this defaults off; test results are published either way (visible under "Test Result" on
  every build), this parameter only controls whether they turn the build itself red.

## Pointing this at company infrastructure

Every `application.properties` in every backend service already reads its database/Eureka/JWT/
service-credential configuration from environment variables, each with a `localhost`-friendly
default baked in - for example, S1's is:

```properties
spring.datasource.url=${DB_URL:jdbc:postgresql://localhost:5432/lbos_platform}
spring.datasource.username=${DB_USERNAME:postgres}
spring.datasource.password=${DB_PASSWORD:postgres}
eureka.client.service-url.defaultZone=${EUREKA_URL:http://localhost:8761/eureka/}
```

**This means pointing the build (or a deployed instance) at your company's Postgres/Eureka never
requires editing a source file** - only setting the corresponding environment variable. Do this in
Jenkins via **Manage Jenkins > System > Global properties > Environment variables** (applies to
every job) or, better, as **Jenkins Credentials** injected into just this job's `environment {}`
block if any of these are secrets you don't want in plain job config:

| Variable | Meaning | Local default |
|---|---|---|
| `DB_URL` | JDBC URL - each service has its own database name baked into the default (`lbos_platform`, `lbos_partner`, `lbos_commerce`, `lbos_order`, `lbos_fleet`, `lbos_finance`) | `jdbc:postgresql://localhost:5432/<service-db>` |
| `DB_USERNAME` / `DB_PASSWORD` | Postgres credentials | `postgres` / `postgres` |
| `EUREKA_URL` | Service registry URL, shared by every service including the gateway | `http://localhost:8761/eureka/` |
| `JWT_SECRET` | Shared JWT signing secret - must be identical across all 6 services + the gateway | dev placeholder (change this for anything beyond local dev) |
| `SERVICE_PASSWORD` | Shared HTTP Basic credential for service-to-service `/internal/**` calls | `service123` |
| `CORS_ALLOWED_ORIGINS` | API Gateway CORS allowlist | `http://localhost:3000,http://localhost:5173` |

The `Jenkinsfile`'s `environment {}` block already reads all of these from the Jenkins environment
if set, falling back to the same local defaults - so setting them in Jenkins is the entire change
needed. **Never hand-edit an `application.properties` file to point it at a company server** - if
you already have (the original ask that started this), the next `git pull`/merge will silently
revert it back to `localhost`, and the edit won't travel with the build to a different agent
either. Environment variables are the durable, portable way to do this.

If your company's Maven/npm access goes through an internal mirror rather than the public
internet, that's configured at the tool level, not in this repo:
- Maven: `~/.m2/settings.xml` on the Jenkins agent (a `<mirror>` entry pointing at your Nexus/
  Artifactory).
- npm: a project or user-level `.npmrc` (`registry=https://your-mirror/...`) or `npm config set
  registry ...` on the agent.
- If your proxy works via the standard `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` environment
  variables, both Maven and npm already respect those automatically with no extra configuration.

None of this is (or should be) committed to the repository - it's Jenkins/agent-level
infrastructure configuration, same as any other company's internal mirror setup.

## Test status: all green

As of 2026-09-14, every module passes with zero failures and zero errors - `eureka-server`,
`api-gateway`, all 6 backend services (`S1`-`S6`), confirmed both via a real Jenkins run and
locally. The 56 problems an earlier Jenkins run on this same day surfaced have all been resolved:
2 were genuine bugs (a stale gateway authorization test, a Mockito strict-stubs issue in an S6
refund test), and the remaining 54 were stale tests across `S1`/`S3`/`S4` written before legitimate
behavior changes this session (an inventory status enum replacing a raw String, a cart address
precondition, closed-store product hiding, a checkout retailer-breakdown rewrite, mandatory
trip-proof-image validation, and several `@InjectMocks` constructor-argument drifts) - all fixed on
the test side, with no production code changes required. See the git history around this date for
the detailed per-module breakdown of what each fix actually was.

Because of this, `FAIL_ON_TEST_FAILURES` now defaults to `true` - a real test failure fails the
build, as it should once there's no backlog of known-stale tests to tolerate. If a future change
legitimately needs to widen behavior again (the same pattern behind most of the above), expect a
short window where fixing the test alongside the code is part of that change, not a separate
cleanup pass.

## Known remaining feature gap (not a build issue)

Separately from anything Jenkins-related: the retailer/fleet-owner suspension cascade (S2
notifying S4 to cancel that partner's in-flight orders when they're suspended) has its S4-side
method restored, but S2's caller into it was dropped by the same external rectification pass and
has not yet been restored - so the feature compiles cleanly on both ends but nothing currently
invokes it end-to-end. This doesn't affect the build; it's a functional gap for a future session.
