import { setIcon } from "obsidian";

/**
 * A bar that scrolls sideways (settings tabs, the Tasks list bar): when not everything fits, an arrow button appears
 * on the side that has more, and that edge fades out. On desktop the mouse wheel scrolls the bar sideways too
 * (a plain wheel only scrolls up and down). `wrap` holds `bar`; the arrows are added beside the bar.
 * Returns a function that stops watching the size (call it before the bar is drawn again or removed).
 */
export function scrollArrows(wrap: HTMLElement, bar: HTMLElement, label: string): () => void {
	wrap.addClass("ch-scroll-wrap");
	bar.addClass("ch-scroll-bar");
	const arrow = (dir: -1 | 1) => {
		const b = wrap.createEl("button", { cls: `ch-tabs-arrow ${dir < 0 ? "ch-tabs-prev" : "ch-tabs-next"}`, attr: { "aria-label": label } });
		setIcon(b, dir < 0 ? "chevron-left" : "chevron-right");
		b.onclick = () => bar.scrollBy({ left: dir * Math.max(120, bar.clientWidth * 0.6), behavior: "smooth" });
		return b;
	};
	const prev = arrow(-1);
	wrap.prepend(prev);
	const next = arrow(1);
	const update = () => {
		// Not laid out yet (e.g. a window still opening): no arrows; the observer below re-checks.
		const laidOut = bar.clientWidth > 0;
		const left = laidOut && bar.scrollLeft > 2;
		const right = laidOut && bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
		bar.toggleClass("ch-more-left", left);
		bar.toggleClass("ch-more-right", right);
		prev.toggleClass("is-hidden", !left);
		next.toggleClass("is-hidden", !right);
	};
	bar.addEventListener("scroll", update, { passive: true });
	// Mouse wheel (up / down) scrolls sideways, but only when there is something to scroll.
	bar.addEventListener("wheel", (e) => {
		if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || bar.scrollWidth <= bar.clientWidth) return;
		e.preventDefault();
		bar.scrollLeft += e.deltaY;
		update();
	}, { passive: false });
	const observer = new ResizeObserver(() => update());
	observer.observe(wrap);
	observer.observe(bar);
	window.requestAnimationFrame(update);
	return () => observer.disconnect();
}
