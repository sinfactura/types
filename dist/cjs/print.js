"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LABEL_TEMPLATE_IDS = void 0;
/**
 * The five label footprints the app's `LABEL_TEMPLATES` ships; `^PW`/`^LL`
 * presets on the api's ZPL producer.
 *
 * Deliberately NOT `declare global` — unlike `PrintUseCase` / `PrintRawFormat`
 * below, this vocabulary is needed as a *value*: the api validates an incoming
 * `template` against it and the producer keys its per-template dimensions off
 * it, so it must survive to runtime. A `declare global` block emits nothing.
 * That means it is IMPORTED, not ambient:
 *
 * ```ts
 * import { LABEL_TEMPLATE_IDS, type LabelTemplateId } from 'sinfactura-types';
 * ```
 *
 * Order is the operator-facing display order and is load-bearing for neither
 * consumer; treat it as a set. `producto` is the default template.
 */
exports.LABEL_TEMPLATE_IDS = ['producto', 'precio', 'estante', 'envio', 'inventario'];
