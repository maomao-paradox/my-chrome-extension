/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/patch/xhr-patch/rules/index.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import { type XhrRulesMap } from '@/assets/types';
import { rules as mriaRules } from './mria';
import {rules as qaproRules } from './qapro'

const rules: Record<string, XhrRulesMap> = {
    mria: mriaRules,
    qapro: qaproRules,
};

export default rules;