"use strict";
// Platform-wide config/feature-flag contracts (api#1108). Single fixed
// GLOBALS/PLATFORM scope, unlike Literals' multi-scope override chain — no
// per-tenant override use case identified for globals/flags (deliberate
// divergence from api#1484/#1485's Literals model).
Object.defineProperty(exports, "__esModule", { value: true });
