import { byId } from "../utils/dom";

export function closeMobileNav(): void {
  const menu = document.getElementById("nav-menu") as HTMLDetailsElement | null;
  if (menu && window.matchMedia("(max-width: 639px)").matches) menu.open = false;
}

export function bindNav(handlers: Record<string, () => void>): void {
  for (const [href, handler] of Object.entries(handlers)) {
    document.querySelectorAll(`a[href="${href}"]`).forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        handler();
        closeMobileNav();
      });
    });
  }
  const brand = document.querySelector('a.brand[href="#hero"]');
  brand?.addEventListener("click", (event) => {
    event.preventDefault();
    byId("hero").scrollIntoView({ behavior: "smooth", block: "start" });
    closeMobileNav();
  });
}
