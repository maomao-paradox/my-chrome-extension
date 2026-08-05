let powWorker: Worker | null = null;
let isPowWorkerReady = false;

const initPowWorker = (): void => {
  try {
    if (isPowWorkerReady) {
      return;
    }

    const workerUrl = chrome.runtime.getURL('static/js/workers/pow-worker.min.js');
    maLogger.log('Creating POW Worker with URL:', workerUrl);
    fetch(workerUrl)
      .then((response) => response.text())
      .then((source) => {
        const blob = new Blob([source], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);
        maLogger.log('POW Worker created successfully');
        maLogger.log(worker);
        URL.revokeObjectURL(blobUrl);
        return worker;
      })
      .then((worker) => {
        powWorker = worker;

        powWorker.onmessage = (event: MessageEvent) => {
          maLogger.log('Received from POW worker:', event.data);
        };

        powWorker.onerror = (error: ErrorEvent) => {
          maLogger.error('POW Worker error:', error);
          isPowWorkerReady = false;
        };

        isPowWorkerReady = true;
        maLogger.log('POW Worker initialized successfully');
      })
      .catch((error) => {
        maLogger.error('Worker 初始化失败', error);
        isPowWorkerReady = false;
      });
  } catch (error) {
    maLogger.error('Error creating POW worker:', error);
    isPowWorkerReady = false;
  }
};

const doCalculatePOW = (
  challenge: any,
  resolve: (result: string) => void,
  reject: (error: any) => void
): void => {
  try {
    if (!powWorker) {
      reject(new Error('POW worker is not ready'));
      return;
    }

    const originalOnMessage = powWorker.onmessage;

    powWorker.onmessage = (event: MessageEvent) => {
      maLogger.log('Received from POW worker:', event.data);
      if (event.data.type === 'pow-answer') {
        const jsonObject = {
          ...event.data.answer,
          target_path: '/api/v0/chat/completion'
        };
        const powResponse = btoa(unescape(encodeURIComponent(JSON.stringify(jsonObject))));
        maLogger.log('POW response generated:', powResponse);

                powWorker!.onmessage = originalOnMessage;
                resolve(powResponse);
      } else if (event.data.type === 'pow-error') {
        maLogger.error(event.data);
                powWorker!.onmessage = originalOnMessage;
                reject(new Error('POW calculation failed'));
      } else if (originalOnMessage) {
        originalOnMessage.call(powWorker!, event);
      }
    };

    powWorker.postMessage({
      type: 'pow-challenge',
      wasmUrl: chrome.runtime.getURL('static/js/sha3_wasm_bg.7b9ca65ddd.wasm'),
      challenge: {
        ...challenge,
        expireAt: challenge.expire_at
      }
    });

    setTimeout(() => {
      if (powWorker) {
        powWorker.onmessage = originalOnMessage;
      }
      reject(new Error('POW calculation timeout'));
    }, 30000);
  } catch (error) {
    maLogger.error('Error in calculatePOW:', error);
    reject(error);
  }
};

export const calculatePOW = (challenge: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    maLogger.log('Starting POW calculation with challenge:', challenge);
    if (isPowWorkerReady) {
      maLogger.log('POW worker is already ready, starting calculation');
      doCalculatePOW(challenge, resolve, reject);
      return;
    }

    maLogger.log('POW worker not ready, initializing...');
    initPowWorker();

    let checkCount = 0;
    const checkWorker = setInterval(() => {
      checkCount++;
      maLogger.log(`Checking POW worker readiness... (${checkCount})`);
      if (isPowWorkerReady) {
        maLogger.log('POW worker is ready, starting calculation');
        clearInterval(checkWorker);
        doCalculatePOW(challenge, resolve, reject);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkWorker);
      maLogger.error('POW worker initialization timeout after 5 seconds');
      reject(new Error('POW worker initialization timeout'));
    }, 5000);
  });
};
