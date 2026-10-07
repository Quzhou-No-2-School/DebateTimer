/**
 * 浮层关闭后的焦点去向。
 *
 * 不把焦点还给触发按钮：本应用以键盘操作为主，焦点停在控制条按钮上时，
 * Enter / 空格会在快捷键之外再触发一次原生 click（比如重新弹出刚取消的确认框）。
 * 所以默认交还给 body；只有从另一个仍打开的浮层里弹出时（设置面板里点「退出应用」），
 * 才把焦点还给那个浮层的容器。
 */
export function releaseFocus(prev: HTMLElement | null): void {
  const host = prev?.closest<HTMLElement>('[role="dialog"]');
  if (host?.isConnected) {
    host.focus();
    return;
  }
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
