import { Agent, type Dispatcher } from 'undici';

export interface ServerFetchInit extends RequestInit {
  dispatcher?: Dispatcher;
}

let insecureTlsDispatcher: Dispatcher | null = null;

function getInsecureTlsDispatcher(): Dispatcher {
  if (insecureTlsDispatcher) {
    return insecureTlsDispatcher;
  }

  insecureTlsDispatcher = new Agent({
    connect: {
      rejectUnauthorized: false,
    },
  });

  return insecureTlsDispatcher;
}

export function buildServerFetchInit(init: RequestInit, allowInsecureTls: boolean): ServerFetchInit {
  if (!allowInsecureTls) {
    return init;
  }

  return {
    ...init,
    dispatcher: getInsecureTlsDispatcher(),
  };
}
