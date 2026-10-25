import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Principal } from '../types';

// This context is created only after OAuth verification. No request header can set it.
export const mcpIdentity = new AsyncLocalStorage<Principal>();
