#!/usr/bin/env node
/*
 * Run a command at reduced scheduling priority, so a long local check yields
 * the machine instead of fighting for it.
 *
 *   node scripts/lowpri.mjs yarn build
 *   SINFACTURA_QOS=background node scripts/lowpri.mjs yarn lint
 *   SINFACTURA_QOS=off       node scripts/lowpri.mjs yarn lint   # no-op
 *
 * WHY NOT `nice`. On macOS, BSD `nice` adjusts a priority the scheduler
 * largely ignores for this kind of workload — measured on this machine,
 * `nice -n 20` around a 6-way CPU-bound fan-out moved it from 213% to 197%
 * of a core, which is noise. What macOS actually schedules on is the QoS
 * CLASS, and `taskpolicy -c` sets it. The same fan-out under `-c utility`
 * dropped to ~25% while doing identical work: the run gets slower in wall
 * clock and stops evicting everything else from the performance cores. That
 * is the whole trade this wrapper exists to make.
 *
 * ⚠️ THE CLAMP INHERITS TO CHILDREN — verified empirically (spawn N children
 * under the clamp, measure their combined rusage), not assumed from the man
 * page. Neither `eslint .` (this repo's `lint`) nor `tsc` (this repo's
 * `build`) forks worker processes on its own — this is a 48-file contracts
 * package, not a multi-process test fan-out — so each wrapped invocation
 * here is clamped directly, one hop from `taskpolicy` to the tool itself.
 * The inheritance property still matters and is worth keeping documented:
 * it is what makes this wrapper safe to point at anything that DOES shell
 * out (a future script here, or reused as-is against another repo's
 * multi-process suite) without re-deriving whether the clamp survives a
 * fork.
 *
 * ⚠️ IT IS OFF IN CI, DELIBERATELY. A CI runner is dedicated hardware with
 * nothing to yield to, so throttling there buys nothing and costs the whole
 * slowdown. `CI` being set turns this into a transparent pass-through.
 *
 * § Cores, and why "less CPU" is not "less work". An M-series Mac has
 * performance and efficiency cores; a background-QoS process is steered onto
 * the efficiency cores. It therefore consumes MORE total CPU-seconds to do
 * the same work (an E-core retires less per cycle) while holding far fewer
 * cores at any instant. If you are benchmarking cores held vs. total CPU
 * time, expect CPU-seconds to go UP under a clamp — the number that goes
 * down is the percentage of cores held at any instant.
 */

import { spawn } from 'node:child_process';
import { availableParallelism, loadavg } from 'node:os';
import { platform } from 'node:process';

const argv = process.argv.slice(2);

const tierArg = argv[0]?.startsWith('--tier=') ? argv.shift().slice('--tier='.length) : '';
const command = argv;

if (command.length === 0) {
	console.error('usage: node scripts/lowpri.mjs [--tier=utility|background] <command> [args...]');
	process.exit(2);
}

/*
 * § THE CLAMP IS ADAPTIVE, and that is the whole design.
 *
 * Measured on this machine, 6-way CPU-bound fan-out, machine at load 30:
 *
 *     unclamped       9.7s wall   20.8s cpu   213% cores held
 *     nice -n 20     10.7s wall   21.1s cpu   197%   ← BSD nice does nothing
 *     -c utility     92.4s wall   22.9s cpu    25%   ← 9.5x wall clock
 *
 * A 9.5x wall-clock cost is the right trade when several agent sessions
 * across sibling repos are already fighting over six performance cores —
 * nobody was getting their work done anyway, and the clamped run at least
 * stops making it worse. It is the WRONG trade on an idle laptop, where it
 * converts a fast local `build`/`lint` into an unnecessarily slow one:
 * there is nothing to yield to.
 *
 * So the default resolves at launch from the machine's actual state rather
 * than being picked once and baked in. Above `BUSY_LOAD` the machine is
 * already oversubscribed and we clamp; below it we run at full speed. The
 * load average sees everything on the box, not just this package — sibling
 * repos' `eslint`/`tsc`/test runners and Spotlight included.
 *
 * `SINFACTURA_QOS` overrides it: `off` never clamps, `utility`/`background`
 * always clamp at that tier, `auto` (the default) decides per the above.
 *
 * Why `utility` and not `background` when we do clamp. Both steer onto the
 * efficiency cores, but `background` additionally carries a throttled I/O
 * tier, and `tsc`/`eslint` are filesystem-heavy — every source file is read
 * and reparsed on each invocation, and `build` runs `tsc` twice (ESM, then
 * CJS). Throttling their disk turns a slow run into a stalled one.
 */
const BUSY_LOAD = Math.max(2, Math.round(availableParallelism() / 2));

const requested = process.env.SINFACTURA_QOS || tierArg || 'auto';
const load1 = loadavg()[0];
const tier = requested === 'auto' ? (load1 > BUSY_LOAD ? 'utility' : 'off') : requested;

// Windows has neither `taskpolicy` nor `nice`, and `yarn` there needs a shell
// to resolve at all — so it passes straight through rather than growing a
// third branch nobody on this project runs.
const passthrough = tier === 'off' || Boolean(process.env.CI) || platform === 'win32';
const useShell = platform === 'win32';

if (!passthrough && process.env.SINFACTURA_QOS_QUIET !== '1') {
	console.error(`· lowpri: load ${load1.toFixed(1)} > ${BUSY_LOAD}, running at "${tier}" QoS (slower, yields the performance cores). SINFACTURA_QOS=off to disable.`);
}

const [bin, args] = passthrough
	? [command[0], command.slice(1)]
	: platform === 'darwin'
		? ['taskpolicy', ['-c', tier, ...command]]
		: // Linux/CI-adjacent fallback. `nice` is weak, but it is what exists
			// portably, and this path is not the one that matters here.
			['nice', ['-n', '10', ...command]];

const child = spawn(bin, args, { stdio: 'inherit', shell: useShell });

child.on('error', (err) => {
	// A missing `taskpolicy` must not break the command it was meant to slow
	// down — fall back to running it unclamped rather than failing the check.
	if (err.code === 'ENOENT' && !passthrough) {
		const fallback = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: useShell });
		fallback.on('close', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
		return;
	}
	console.error(err.message);
	process.exit(1);
});

child.on('close', (code, signal) => {
	process.exit(signal ? 1 : (code ?? 1));
});
