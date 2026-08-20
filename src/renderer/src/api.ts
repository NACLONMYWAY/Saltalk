import type { Api } from '../../preload/index.ts'

export const api = (window as unknown as { api: Api }).api
