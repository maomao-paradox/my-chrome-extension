/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/patch/xhr-patch/rules/qapro.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import { type XhrRulesMap } from "@/types";

export const rules: XhrRulesMap = {
  "/api/qa-pro/form/one/query": {
    // 拦截响应数据 - 使用JSON指令格式
    responseRules: [
      {
        type: "setField",
        params: {
          path: "response.detail.form_status",
          value: 1,
        },
      },
    ],
  },
};

export default rules;
