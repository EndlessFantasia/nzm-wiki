const LOCATED_CLASS = "located-flash";

/** 深链跳转落地后闪一次底色，帮助用户在列表中认出目标条目 */
export function flashLocatedTarget(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return;

  // 叠加层画在 ::after 上，目标本身无圆角时沿用铺满它的子元素的圆角
  const style = getComputedStyle(element);
  const child = element.firstElementChild;
  const radius =
    parseFloat(style.borderTopLeftRadius) === 0 &&
    child &&
    Math.abs(child.getBoundingClientRect().height - rect.height) < 2
      ? getComputedStyle(child).borderTopLeftRadius
      : style.borderTopLeftRadius;
  element.style.setProperty("--located-radius", radius);
  element.dataset.locatedStatic = String(style.position === "static");

  element.classList.remove(LOCATED_CLASS);
  void element.offsetWidth;
  element.classList.add(LOCATED_CLASS);

  const handleEnd = (event: AnimationEvent) => {
    if (event.target !== element || event.pseudoElement !== "::after") return;
    element.classList.remove(LOCATED_CLASS);
    element.style.removeProperty("--located-radius");
    delete element.dataset.locatedStatic;
    element.removeEventListener("animationend", handleEnd);
  };
  element.addEventListener("animationend", handleEnd);
}

export function revealLocatedTarget(
  elementOrId: HTMLElement | string | null | undefined,
  options: ScrollIntoViewOptions = { block: "center" },
) {
  const element =
    typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;
  if (!element) return;
  element.scrollIntoView(options);
  flashLocatedTarget(element);
}
