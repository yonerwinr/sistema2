/**
 * monkeyAnimation.ts
 * Controlador de cinemática interactiva y animación del Monito FacilitoApp con GSAP.
 */

import gsap from 'gsap';

export interface MonkeyController {
  coverEyes: () => void;
  uncoverEyes: () => void;
  peek: (isPeeking: boolean) => void;
  celebrate: () => void;
  resetFace: () => void;
  destroy: () => void;
}

export function initMonkeyAnimation(
  svgContainer: HTMLElement,
  emailInput: HTMLInputElement | null,
  passwordInput: HTMLInputElement | null,
  passwordToggleBtn?: HTMLElement | null
): MonkeyController {
  const armL = svgContainer.querySelector('#monkey-arm-l');
  const armR = svgContainer.querySelector('#monkey-arm-r');
  const pupilL = svgContainer.querySelector('#monkey-pupil-l');
  const pupilR = svgContainer.querySelector('#monkey-pupil-r');
  const eyebrowL = svgContainer.querySelector('#monkey-eyebrow-l');
  const eyebrowR = svgContainer.querySelector('#monkey-eyebrow-r');
  const headGroup = svgContainer.querySelector('#monkey-head-group');
  const snout = svgContainer.querySelector('#monkey-snout');
  const mouth = svgContainer.querySelector('#monkey-mouth-smile');

  // Posiciones de reposo iniciales (brazos guardados abajo)
  if (armL && armR) {
    gsap.set(armL, { x: -35, y: 110, rotation: 65, transformOrigin: 'bottom left' });
    gsap.set(armR, { x: 35, y: 110, rotation: -65, transformOrigin: 'bottom right' });
  }

  let isCovering = false;
  let isPeeking = false;
  let blinkTimer: any = null;

  // Parpadeo natural aleatorio
  const scheduleBlink = () => {
    const delay = 3500 + Math.random() * 4000;
    blinkTimer = setTimeout(() => {
      if (!isCovering || isPeeking) {
        blink();
      }
      scheduleBlink();
    }, delay);
  };

  const blink = () => {
    if (isCovering && !isPeeking) return;
    const eyes = isPeeking
      ? [svgContainer.querySelector('#monkey-eye-r')]
      : [svgContainer.querySelector('#monkey-eye-l'), svgContainer.querySelector('#monkey-eye-r')];
    gsap.timeline()
      .to(eyes, { scaleY: 0.1, transformOrigin: 'center center', duration: 0.1, ease: 'power1.inOut' })
      .to(eyes, { scaleY: 1, transformOrigin: 'center center', duration: 0.15, ease: 'power1.out' });
  };

  scheduleBlink();

  // Función para tapar los ojos (🙈 Al enfocarse en contraseña)
  const coverEyes = () => {
    isCovering = true;
    isPeeking = false;

    // Resetear posición de pupilas y cabeza al centro antes de tapar
    gsap.to([pupilL, pupilR], { x: 0, y: 0, duration: 0.2 });
    gsap.to(headGroup, { x: 0, y: 0, rotation: 0, duration: 0.25 });
    gsap.to([eyebrowL, eyebrowR], { y: -2, duration: 0.25 });

    // Brazos suben rápidamente
    if (armL) {
      gsap.to(armL, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.4,
        ease: 'power2.out'
      });
    }
    if (armR) {
      gsap.to(armR, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.4,
        ease: 'power2.out',
        delay: 0.04
      });
    }
  };

  // Función para destapar los ojos (Al salir del campo contraseña)
  const uncoverEyes = () => {
    isCovering = false;
    isPeeking = false;

    if (armL) {
      gsap.to(armL, {
        x: -35,
        y: 110,
        rotation: 65,
        duration: 0.5,
        ease: 'power2.inOut'
      });
    }
    if (armR) {
      gsap.to(armR, {
        x: 35,
        y: 110,
        rotation: -65,
        duration: 0.5,
        ease: 'power2.inOut',
        delay: 0.04
      });
    }

    gsap.to([eyebrowL, eyebrowR], { y: 0, rotation: 0, duration: 0.4 });
    resetFace();
  };

  // Modo espía: si el usuario hace clic en ver contraseña mientras está en password (🐵👀)
  const peek = (peeking: boolean) => {
    isPeeking = peeking;

    if (peeking) {
      isCovering = true;
      // Brazo izquierdo se mantiene cubriendo el ojo izquierdo
      if (armL) {
        gsap.to(armL, { x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power2.out' });
      }
      // El brazo derecho baja un poquito para espiar con el ojo derecho
      if (armR) {
        gsap.to(armR, {
          x: 20,
          y: 32,
          rotation: -26,
          duration: 0.35,
          ease: 'power1.out'
        });
      }
      // La pupila derecha mira de reojo hacia el texto
      if (pupilR) {
        gsap.to(pupilR, { x: 3, y: 3.5, duration: 0.25 });
      }
      // Ceja derecha levantada de curiosidad
      if (eyebrowR) {
        gsap.to(eyebrowR, { y: -5, rotation: 4, duration: 0.25 });
      }
    } else {
      // Vuelve a taparse completamente ambos ojos si sigue enfocado
      if (armR) {
        gsap.to(armR, {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 0.3,
          ease: 'power2.out'
        });
      }
      if (pupilR) {
        gsap.to(pupilR, { x: 0, y: 0, duration: 0.2 });
      }
      if (eyebrowR) {
        gsap.to(eyebrowR, { y: -2, rotation: 0, duration: 0.25 });
      }
    }
  };

  // Celebración al iniciar sesión con éxito
  const celebrate = () => {
    isCovering = false;
    uncoverEyes();

    gsap.timeline()
      .to(headGroup, { y: -8, duration: 0.2, ease: 'power1.out' })
      .to(headGroup, { y: 0, duration: 0.3, ease: 'bounce.out' });

    if (mouth) {
      gsap.to(mouth, { scaleY: 1.25, transformOrigin: 'center center', duration: 0.3, yoyo: true, repeat: 1 });
    }
  };

  // Re-centrado de cara
  const resetFace = () => {
    gsap.to([pupilL, pupilR], { x: 0, y: 0, duration: 0.45, ease: 'power2.out' });
    gsap.to(headGroup, { x: 0, y: 0, rotation: 0, duration: 0.45, ease: 'power2.out' });
    gsap.to([eyebrowL, eyebrowR], { x: 0, y: 0, rotation: 0, duration: 0.45, ease: 'power2.out' });
    gsap.to(snout, { x: 0, y: 0, duration: 0.45, ease: 'power2.out' });
  };

  // Medidor del cursor de texto en el input de email
  const trackCaret = (input: HTMLInputElement) => {
    if (isCovering) return;

    const val = input.value || '';
    const selPos = input.selectionEnd ?? val.length;

    // Medición exacta de posición del cursor en px creando un span espejo invisible
    const measureSpan = document.createElement('span');
    const inputStyle = window.getComputedStyle(input);
    measureSpan.style.font = inputStyle.font;
    measureSpan.style.letterSpacing = inputStyle.letterSpacing;
    measureSpan.style.whiteSpace = 'pre';
    measureSpan.style.position = 'absolute';
    measureSpan.style.visibility = 'hidden';
    measureSpan.textContent = val.substring(0, selPos) || ' ';
    document.body.appendChild(measureSpan);

    const caretPx = measureSpan.getBoundingClientRect().width;
    document.body.removeChild(measureSpan);

    const inputWidth = input.clientWidth || 320;
    // Normalizar de -1 (izquierda) a +1 (derecha)
    const ratio = Math.max(0, Math.min(1, caretPx / Math.max(inputWidth, 1)));
    const normX = (ratio - 0.5) * 2; // de -1 a 1

    // Desplazamiento máximo de pupilas (límite visual dentro del ojo blanco)
    const maxPupilX = 6.5;
    const pupilX = normX * maxPupilX;
    // Cuando el usuario escribe, el monito mira hacia abajo (hacia el teclado/input)
    const pupilY = 3.2;

    gsap.to([pupilL, pupilR], {
      x: pupilX,
      y: pupilY,
      duration: 0.15,
      ease: 'power1.out'
    });

    // Ligero paralaje del rostro completo para realismo 3D
    const headX = normX * 3.5;
    const headRot = normX * 2.5;
    gsap.to(headGroup, {
      x: headX,
      y: 1.5,
      rotation: headRot,
      transformOrigin: 'center center',
      duration: 0.25,
      ease: 'power1.out'
    });

    // Inclinación de cejas
    gsap.to(eyebrowL, {
      y: normX > 0 ? 1 : -1,
      rotation: normX * 3,
      duration: 0.25
    });
    gsap.to(eyebrowR, {
      y: normX < 0 ? 1 : -1,
      rotation: normX * 3,
      duration: 0.25
    });
  };

  // Event Listeners
  const onEmailInput = (e: Event) => {
    trackCaret(e.target as HTMLInputElement);
  };

  const onEmailFocus = (e: Event) => {
    if (isCovering) {
      uncoverEyes();
    }
    trackCaret(e.target as HTMLInputElement);
  };

  const onEmailBlur = () => {
    if (!isCovering) {
      resetFace();
    }
  };

  const onPassFocus = () => {
    coverEyes();
  };

  const onPassBlur = () => {
    uncoverEyes();
  };

  // Vincular eventos a los inputs
  if (emailInput) {
    emailInput.addEventListener('input', onEmailInput);
    emailInput.addEventListener('focus', onEmailFocus);
    emailInput.addEventListener('blur', onEmailBlur);
    emailInput.addEventListener('keyup', onEmailInput);
    emailInput.addEventListener('click', onEmailInput);
  }

  if (passwordInput) {
    passwordInput.addEventListener('focus', onPassFocus);
    passwordInput.addEventListener('blur', onPassBlur);
  }

  // Si hay un botón de alternar visibilidad de contraseña
  if (passwordToggleBtn) {
    passwordToggleBtn.addEventListener('click', () => {
      if (passwordInput) {
        const isPassShown = passwordInput.type === 'text';
        peek(isPassShown);
      }
    });
  }

  return {
    coverEyes,
    uncoverEyes,
    peek,
    celebrate,
    resetFace,
    destroy: () => {
      if (blinkTimer) clearTimeout(blinkTimer);
      if (emailInput) {
        emailInput.removeEventListener('input', onEmailInput);
        emailInput.removeEventListener('focus', onEmailFocus);
        emailInput.removeEventListener('blur', onEmailBlur);
        emailInput.removeEventListener('keyup', onEmailInput);
        emailInput.removeEventListener('click', onEmailInput);
      }
      if (passwordInput) {
        passwordInput.removeEventListener('focus', onPassFocus);
        passwordInput.removeEventListener('blur', onPassBlur);
      }
    }
  };
}
