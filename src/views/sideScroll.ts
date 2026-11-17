/**
 * A bar that scrolls sideways (settings tabs, the Tasks list bar). On desktop it has a thin scrollbar underneath that is
 * always visible (styles.css, `.ch-side-scroll`), and the mouse wheel scrolls it sideways (a plain wheel only scrolls up
 * and down). On phones there is no scrollbar: you swipe. Everywhere, the edge with more fades out.
 * Returns a function that stops watching the size (call it before the bar is drawn again or removed).
 */
export function sideScroll(bar: HTMLElement): () => void {
	bar.addClass("ch-side-scroll");
	const update = () => {
		// Not laid out yet (e.g. a window still opening): no fade; the observer below re-checks.
		const laidOut = bar.clientWidth > 0;
		bar.toggleClass("ch-more-left", laidOut && bar.scrollLeft > 2);
		bar.toggleClass("ch-more-right", laidOut && bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2);
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
	observer.observe(bar);
	window.requestAnimationFrame(update);
	return () => observer.disconnect();
}
