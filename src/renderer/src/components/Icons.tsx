/**
 * SVG 图标精灵。
 *
 * 全站图标统一放在一个隐藏的 <svg><defs> 里，用 <use href="#id"> 引用：
 *  - 一份定义多处复用，DOM 不会随图标数量膨胀
 *  - 描边/填充全部走 currentColor，跟着文字色走，天然适配明暗主题
 *  - 线性图标统一 1.7 描边、圆角端点，和 13.5px 正文同一套视觉密度
 *
 * 用法：<svg className="i"><use href="#i-play" /></svg>
 */
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-mark" viewBox="0 0 24 24">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h8A2.5 2.5 0 0 1 17 6.5v3A2.5 2.5 0 0 1 14.5 12H9l-3 2.5V12h-.5A1.5 1.5 0 0 1 4 10.5z" />
          <circle cx="17.2" cy="15.4" r="3.6" />
        </symbol>
        <symbol id="i-play" viewBox="0 0 24 24">
          <path d="M7 4.8v14.4L19 12z" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-stop" viewBox="0 0 24 24">
          <rect x="6.5" y="6.5" width="11" height="11" rx="1.6" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-shuffle" viewBox="0 0 24 24">
          <path d="M17 3.5 20.5 7 17 10.5" />
          <path d="M3.5 7h4.2c1.3 0 2.5.6 3.2 1.7l3.2 4.6c.7 1.1 1.9 1.7 3.2 1.7h3.2" />
          <path d="M17 13.5 20.5 17 17 20.5" />
          <path d="M3.5 17h4.2c1.3 0 2.5-.6 3.2-1.7" />
        </symbol>
        <symbol id="i-spark" viewBox="0 0 24 24">
          <path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.8L12 18.3l-1.7-5.8L4.5 10.7 10.3 9z" />
        </symbol>
        <symbol id="i-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.1M12 19.3v2.1M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
        </symbol>
        <symbol id="i-moon" viewBox="0 0 24 24">
          <path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z" />
        </symbol>
        <symbol id="i-chev" viewBox="0 0 24 24">
          <path d="m6 9.5 6 6 6-6" />
        </symbol>
        <symbol id="i-chev-r" viewBox="0 0 24 24">
          <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
        </symbol>
        <symbol id="i-chev-l" viewBox="0 0 24 24">
          <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="m4.8 12.6 4.8 4.8L19.2 6.8" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24">
          <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5.2v13.6M5.2 12h13.6" />
        </symbol>
        <symbol id="i-loop" viewBox="0 0 24 24">
          <path d="M4 9.5A5.5 5.5 0 0 1 9.5 4h8" />
          <path d="m14.5 1.5 3 2.5-3 2.5" />
          <path d="M20 14.5A5.5 5.5 0 0 1 14.5 20h-8" />
          <path d="m9.5 22.5-3-2.5 3-2.5" />
        </symbol>
        <symbol id="i-speed" viewBox="0 0 24 24">
          <path d="M3.6 17a9 9 0 1 1 16.8 0" />
          <path d="M12 12.5 16 8.4" />
          <circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-trs" viewBox="0 0 24 24">
          <path d="M3.6 6.2h8.2M7.7 4.4v1.8c0 4-1.7 7.2-4.1 9.1" />
          <path d="M5.4 11.6c.9 2.2 2.6 4 4.6 5" />
          <path d="M12.6 20l4-10 4 10" />
          <path d="M14.1 16.6h5" />
        </symbol>
        <symbol id="i-vol" viewBox="0 0 24 24">
          <path d="M4.5 9.5h3.2L12 5.6v12.8L7.7 14.5H4.5z" />
          <path d="M15.6 9.4a3.6 3.6 0 0 1 0 5.2" />
          <path d="M18.2 7a7 7 0 0 1 0 10" />
        </symbol>
        <symbol id="i-trash" viewBox="0 0 24 24">
          <path d="M4.6 6.6h14.8" />
          <path d="M9.4 6.6V4.9c0-.7.6-1.3 1.3-1.3h2.6c.7 0 1.3.6 1.3 1.3v1.7" />
          <path d="M6.6 6.6 7.5 19c.05.7.6 1.2 1.3 1.2h6.4c.7 0 1.25-.5 1.3-1.2l.9-12.4" />
        </symbol>
        <symbol id="i-undo" viewBox="0 0 24 24">
          <path d="M4.4 9.6h9.2a5.6 5.6 0 0 1 0 11.2H8.6" />
          <path d="m8.2 5.4-3.8 4.2 3.8 4.2" />
        </symbol>
        <symbol id="i-info" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.6" />
          <path d="M12 11.2v5.2" />
          <circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-alert" viewBox="0 0 24 24">
          <path d="M12 3.4 21.4 20H2.6z" />
          <path d="M12 9.6v4.6" />
          <circle cx="12" cy="17.2" r=".95" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.6" />
          <path d="M12 7.2V12l3.4 2.1" />
        </symbol>
        <symbol id="i-lock" viewBox="0 0 24 24">
          <rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.2" />
          <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
          <path d="M12 14.2v2.2" />
        </symbol>
        <symbol id="i-book" viewBox="0 0 24 24">
          <path d="M4.4 5.2c0-.9.7-1.6 1.6-1.6h4.4c.9 0 1.6.7 1.6 1.6v14c0-.9-.7-1.6-1.6-1.6H6c-.9 0-1.6.7-1.6 1.6z" />
          <path d="M19.6 5.2c0-.9-.7-1.6-1.6-1.6h-4.4c-.9 0-1.6.7-1.6 1.6v14c0-.9.7-1.6 1.6-1.6h4.4c.9 0 1.6.7 1.6 1.6z" />
        </symbol>
        <symbol id="i-layers" viewBox="0 0 24 24">
          <path d="m12 2.8 8.6 4.4L12 11.6 3.4 7.2z" />
          <path d="m3.4 12.2 8.6 4.4 8.6-4.4" />
          <path d="m3.4 16.8 8.6 4.4 8.6-4.4" />
        </symbol>
        <symbol id="i-sliders" viewBox="0 0 24 24">
          <path d="M4.4 7.2h9M17.2 7.2h2.4" />
          <circle cx="15.2" cy="7.2" r="2" />
          <path d="M4.4 16.8h2.4M10.4 16.8h9.2" />
          <circle cx="8.4" cy="16.8" r="2" />
        </symbol>
        <symbol id="i-text" viewBox="0 0 24 24">
          <path d="M4.6 6.4V4.6h14.8v1.8" />
          <path d="M12 4.6v14.8" />
          <path d="M8.8 19.4h6.4" />
        </symbol>
      </defs>
    </svg>
  )
}
