/**
 * config 表键名的唯一来源。
 *
 * 主进程和渲染层都要读写这些键，之前各写一份字符串，一旦拼错就是静默失效
 * （读回来是 null，代码走了兜底分支，表面看不出问题）。统一放这里。
 */
export const CONFIG_KEYS = {
  /** 难度体系：cefr | ielts | cet */
  system: 'exam_system',
  /** 上次使用的难度等级 */
  level: 'last_level',
  /** 角色 A 音色 */
  voiceA: 'voice_a',
  /** 角色 B 音色 */
  voiceB: 'voice_b',
  /** 四六级题干朗读音色 */
  voiceNarrator: 'voice_narrator',
  /** Deepseek API Key */
  apiKey: 'deepseek_api_key',
  /** 仅记录当前版本号，不做数据清理 */
  appVersion: 'app_version'
} as const

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS]
