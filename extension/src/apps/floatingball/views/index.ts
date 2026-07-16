/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/floatingball/components/index.ts
 * @date 2026-02-05T02:38:01.688Z
 */

// import MockData from './MockData.vue'
// import Brute from './PasswordBrute.vue'
// import Crypto from './MACrypto.vue'
// import JsonFmt from './JsonFormater.vue'
import ImageDownload from './ImageDownload.vue';
import ScriptRunner from './ScriptRunner.vue';

const toolMap = {
  // mock: NotFound,
  // brute: NotFound,
  // crypto: NotFound,
  // json: NotFound,
  image: ImageDownload,
  script: ScriptRunner
};

export default toolMap;