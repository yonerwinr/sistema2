/**
 * Controlador de Animaciones de Scroll mediante IntersectionObserver.
 * Permite inicializar y observar dinámicamente elementos con la clase `.animate-on-scroll`.
 */

export function initScrollAnimations(): void {
  const elements = document.querySelectorAll('.animate-on-scroll');

  if (elements.length === 0) return;

  const observerOptions: IntersectionObserverInit = {
    root: null, // viewport
    rootMargin: '0px',
    threshold: 0.15 // Se activa cuando el 15% del elemento es visible
  };

  const observer = new IntersectionObserver((entries, self) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Añadir clase visible
        entry.target.classList.add('visible');
        // Dejar de observar para que la animación solo ocurra una vez
        self.unobserve(entry.target);
      }
    });
  }, observerOptions);

  elements.forEach(element => {
    // Si ya es visible, no volver a aplicar
    if (!element.classList.contains('visible')) {
      observer.observe(element);
    }
  });
}

/**
 * Aplica clases de animación a un contenedor de forma escalonada para sus hijos directos.
 * @param parentSelector Selector del elemento padre
 * @param animationClass Clase de animación individual (ej. 'animate-fade-up')
 */
export function applyStaggeredAnimation(parentSelector: string, animationClass: string = 'animate-fade-up'): void {
  const container = document.querySelector(parentSelector);
  if (!container) return;

  const children = container.children;
  Array.from(children).forEach((child, index) => {
    child.classList.add('animate-on-scroll', animationClass);
    // Asignar delay en línea para flexibilizar
    (child as HTMLElement).style.transitionDelay = `${index * 80}ms`;
  });
}
