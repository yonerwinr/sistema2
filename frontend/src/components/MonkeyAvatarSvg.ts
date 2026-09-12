/**
 * MonkeyAvatarSvg.ts
 * Plantilla SVG interactiva del monito oficial de FacilitoApp.
 * Diseñado con capas vectoriales exactas para seguimiento de cursor y cobertura de ojos.
 */

export function getMonkeyAvatarSvg(): string {
  return `
    <div class="monkey-avatar-wrap">
      <div class="monkey-badge-glow"></div>
      <svg id="monkey-svg" class="monkey-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Máscara circular para recortar el cuerpo y los brazos dentro del marco -->
          <clipPath id="monkey-circle-clip">
            <circle cx="100" cy="100" r="96" />
          </clipPath>

          <!-- Máscara de ojo izquierdo para que la pupila nunca se salga del globo ocular -->
          <clipPath id="eye-clip-l">
            <ellipse cx="80" cy="84" rx="13" ry="16" />
          </clipPath>

          <!-- Máscara de ojo derecho -->
          <clipPath id="eye-clip-r">
            <ellipse cx="120" cy="84" rx="13" ry="16" />
          </clipPath>

          <!-- Gradiente de fondo del badge (Azul Eléctrico a Azul Marino Profundo de FacilitoApp) -->
          <linearGradient id="monkey-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0088ff" />
            <stop offset="45%" stop-color="#0066e0" />
            <stop offset="100%" stop-color="#052147" />
          </linearGradient>

          <!-- Gradiente de la camiseta naranja oficial de FacilitoApp -->
          <linearGradient id="monkey-shirt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ff8c1a" />
            <stop offset="100%" stop-color="#e65c00" />
          </linearGradient>

          <!-- Gradiente del pelaje del monito -->
          <linearGradient id="monkey-fur-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#a36b41" />
            <stop offset="100%" stop-color="#804b25" />
          </linearGradient>

          <!-- Sombra suave para las patitas -->
          <filter id="paw-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1a0c02" flood-opacity="0.35" />
          </filter>
        </defs>

        <!-- FONDO DEL BADGE (Círculo recortado) -->
        <g clip-path="url(#monkey-circle-clip)">
          <circle cx="100" cy="100" r="98" fill="url(#monkey-bg-grad)" />

          <!-- Estrellas y destellos del fondo (Idénticos al logo oficial) -->
          <g class="monkey-stars" opacity="0.85">
            <!-- Estrella superior izquierda -->
            <path d="M42 38 L44 43 L49 44 L45 47 L46 52 L42 49 L37 52 L38 47 L35 44 L40 43 Z" fill="#ffffff" opacity="0.9" />
            <!-- Pequeño destello superior derecho -->
            <polygon points="160,34 162,39 167,40 163,43 164,48 160,45 156,48 157,43 153,40 158,39" fill="#ffb833" opacity="0.8" />
            <!-- Círculos de moneda/partícula dorada -->
            <circle cx="36" cy="78" r="7" fill="#f59e0b" opacity="0.75" />
            <circle cx="36" cy="78" r="5" fill="#fcd34d" opacity="0.9" />
            <circle cx="166" cy="74" r="4" fill="#60a5fa" opacity="0.7" />
            <!-- Líneas de datos o gráficos sutiles como en el logo -->
            <circle cx="152" cy="54" r="3" fill="#ffffff" opacity="0.5" />
            <line x1="152" y1="54" x2="166" y2="74" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.4" />
          </g>

          <!-- CUERPO Y CAMISETA (Debajo de la cabeza) -->
          <g id="monkey-body-group">
            <!-- Hombros y Torso -->
            <path d="M38 175 C45 142, 65 136, 100 136 C135 136, 155 142, 162 175 L168 205 L32 205 Z" fill="url(#monkey-shirt-grad)" />
            
            <!-- Cuello de la camiseta -->
            <path d="M78 136 C86 148, 114 148, 122 136 C126 144, 118 152, 100 152 C82 152, 74 144, 78 136 Z" fill="#cc5200" />
            
            <!-- Logo "F" en el pecho de la camiseta -->
            <g transform="translate(94, 155) scale(0.65)">
              <path d="M3 0 H16 C17.5 0, 18 1, 18 2.5 C18 4, 17 5, 15.5 5 H8 V9 H13.5 C15 9, 15.5 10, 15.5 11.5 C15.5 13, 14.5 14, 13 14 H8 V20 C8 21.5, 7 22, 5.5 22 C4 22, 3 21, 3 19.5 Z" fill="#ffffff" />
            </g>
          </g>

          <!-- CABEZA COMPLETA DEL MONITO (Grupo animable para inclinación) -->
          <g id="monkey-head-group">
            
            <!-- OREJA IZQUIERDA -->
            <g id="monkey-ear-l" class="monkey-ear">
              <ellipse cx="38" cy="88" rx="20" ry="22" fill="url(#monkey-fur-grad)" stroke="#63391b" stroke-width="2.5" />
              <ellipse cx="40" cy="88" rx="12" ry="14" fill="#fed8a7" />
              <path d="M42 82 C37 85, 37 92, 42 95" stroke="#e6af77" stroke-width="2" stroke-linecap="round" fill="none" />
            </g>

            <!-- OREJA DERECHA -->
            <g id="monkey-ear-r" class="monkey-ear">
              <ellipse cx="162" cy="88" rx="20" ry="22" fill="url(#monkey-fur-grad)" stroke="#63391b" stroke-width="2.5" />
              <ellipse cx="160" cy="88" rx="12" ry="14" fill="#fed8a7" />
              <path d="M158 82 C163 85, 163 92, 158 95" stroke="#e6af77" stroke-width="2" stroke-linecap="round" fill="none" />
            </g>

            <!-- BASE DE LA CABEZA (Pelaje marrón) -->
            <path id="monkey-skull" d="M48 94 C48 54, 70 38, 100 38 C130 38, 152 54, 152 94 C152 130, 130 144, 100 144 C70 144, 48 130, 48 94 Z" fill="url(#monkey-fur-grad)" stroke="#63391b" stroke-width="2.5" />

            <!-- MECHÓN DE PELO SUPERIOR (Característico del logo) -->
            <path id="monkey-hair-tuft" d="M93 40 C95 24, 107 24, 106 33 C111 26, 119 28, 114 39 Z" fill="#804b25" stroke="#63391b" stroke-width="2" stroke-linejoin="round" />

            <!-- MÁSCARA FACIAL EN FORMA DE CORAZÓN/CACAHUATE (Color crema/durazno) -->
            <path id="monkey-face-mask" d="M100 60 C86 52, 60 54, 58 78 C56 94, 68 106, 70 114 C74 128, 86 138, 100 138 C114 138, 126 128, 130 114 C132 106, 144 94, 142 78 C140 54, 114 52, 100 60 Z" fill="#fed8a7" stroke="#e5b37e" stroke-width="1.5" />

            <!-- MEJILLAS SONROSADAS -->
            <circle cx="68" cy="104" r="8" fill="#ff7a7a" opacity="0.38" />
            <circle cx="132" cy="104" r="8" fill="#ff7a7a" opacity="0.38" />

            <!-- CEJAS EXPRESIVAS -->
            <g id="monkey-eyebrows">
              <path id="monkey-eyebrow-l" d="M70 68 C74 65, 84 66, 88 70" stroke="#5a2f12" stroke-width="3.5" stroke-linecap="round" fill="none" />
              <path id="monkey-eyebrow-r" d="M112 70 C116 66, 126 65, 130 68" stroke="#5a2f12" stroke-width="3.5" stroke-linecap="round" fill="none" />
            </g>

            <!-- GLOBO OCULAR IZQUIERDO -->
            <g id="monkey-eye-l" class="monkey-eye-wrap">
              <ellipse cx="80" cy="84" rx="13" ry="16" fill="#ffffff" stroke="#63391b" stroke-width="2" />
              <!-- Pupila interactiva con clip -->
              <g clip-path="url(#eye-clip-l)">
                <g id="monkey-pupil-l" class="monkey-pupil">
                  <circle cx="80" cy="84" r="8" fill="#24140a" />
                  <circle cx="82.5" cy="85" r="7" fill="#382112" />
                  <!-- Reflejos de luz grandes y brillantes -->
                  <circle cx="77.5" cy="80.5" r="3" fill="#ffffff" />
                  <circle cx="83.5" cy="87.5" r="1.5" fill="#ffffff" />
                </g>
              </g>
            </g>

            <!-- GLOBO OCULAR DERECHO -->
            <g id="monkey-eye-r" class="monkey-eye-wrap">
              <ellipse cx="120" cy="84" rx="13" ry="16" fill="#ffffff" stroke="#63391b" stroke-width="2" />
              <!-- Pupila interactiva con clip -->
              <g clip-path="url(#eye-clip-r)">
                <g id="monkey-pupil-r" class="monkey-pupil">
                  <circle cx="120" cy="84" r="8" fill="#24140a" />
                  <circle cx="122.5" cy="85" r="7" fill="#382112" />
                  <!-- Reflejos de luz grandes y brillantes -->
                  <circle cx="117.5" cy="80.5" r="3" fill="#ffffff" />
                  <circle cx="123.5" cy="87.5" r="1.5" fill="#ffffff" />
                </g>
              </g>
            </g>

            <!-- HOCICO Y NARIZ -->
            <g id="monkey-snout">
              <!-- Dos fosas nasales amigables -->
              <ellipse cx="96" cy="98" rx="2.2" ry="2.8" fill="#5a2f12" />
              <ellipse cx="104" cy="98" rx="2.2" ry="2.8" fill="#5a2f12" />
              <!-- Línea sutil de la naricita -->
              <path d="M94 95 C98 94, 102 94, 106 95" stroke="#d49d63" stroke-width="1.5" stroke-linecap="round" fill="none" />
            </g>

            <!-- BOCA (Sonrisa amplia y simpática) -->
            <g id="monkey-mouth-wrap">
              <!-- Boca Sonriente Abierta -->
              <g id="monkey-mouth-smile">
                <!-- Cavidad bucal oscura -->
                <path id="mouth-cavity" d="M84 108 C84 126, 116 126, 116 108 Z" fill="#541217" stroke="#63391b" stroke-width="2" stroke-linejoin="round" />
                <!-- Diente blanco superior sutil -->
                <path d="M94 108 H106 C106 111, 104 113, 100 113 C96 113, 94 111, 94 108 Z" fill="#ffffff" />
                <!-- Lengüita rosada alegre -->
                <path d="M90 120 C94 115, 106 115, 110 120 C106 125, 94 125, 90 120 Z" fill="#ff708a" />
              </g>
              <!-- Línea de comisura superior -->
              <path d="M80 108 Q100 112 120 108" stroke="#63391b" stroke-width="2.5" stroke-linecap="round" fill="none" />
            </g>

          </g> <!-- /monkey-head-group -->

          <!-- BRAZOS Y PATITAS QUE SE TAPARÁN LOS OJOS -->
          <g id="monkey-arms-container" filter="url(#paw-shadow)">
            
            <!-- BRAZO Y PATITA IZQUIERDA -->
            <g id="monkey-arm-l" class="monkey-arm">
              <!-- Brazo peludo marrón -->
              <path d="M30 220 C25 180, 50 120, 78 98 C82 95, 88 98, 86 104 C74 135, 60 175, 52 220 Z" fill="url(#monkey-fur-grad)" stroke="#63391b" stroke-width="2" />
              <!-- Mano / Palma con dedos del monito -->
              <g id="monkey-hand-l">
                <ellipse cx="80" cy="86" rx="17" ry="15" fill="#8d5b36" stroke="#63391b" stroke-width="2" />
                <ellipse cx="80" cy="87" rx="11" ry="9" fill="#fed8a7" opacity="0.9" />
                <!-- Dedo 1 (Pulgar) -->
                <ellipse cx="64" cy="91" rx="5" ry="7" transform="rotate(-30 64 91)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="64" cy="91" rx="3" ry="4.5" transform="rotate(-30 64 91)" fill="#fed8a7" />
                <!-- Dedo 2 (Índice) -->
                <ellipse cx="71" cy="74" rx="5" ry="7.5" transform="rotate(-15 71 74)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="71" cy="74" rx="3" ry="5" transform="rotate(-15 71 74)" fill="#fed8a7" />
                <!-- Dedo 3 (Medio) -->
                <ellipse cx="81" cy="72" rx="5.2" ry="8" transform="rotate(2 81 72)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="81" cy="72" rx="3.2" ry="5.5" transform="rotate(2 81 72)" fill="#fed8a7" />
                <!-- Dedo 4 (Anular) -->
                <ellipse cx="91" cy="75" rx="5" ry="7.5" transform="rotate(18 91 75)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="91" cy="75" rx="3" ry="5" transform="rotate(18 91 75)" fill="#fed8a7" />
              </g>
            </g>

            <!-- BRAZO Y PATITA DERECHA -->
            <g id="monkey-arm-r" class="monkey-arm">
              <!-- Brazo peludo marrón derecho -->
              <path d="M170 220 C175 180, 150 120, 122 98 C118 95, 112 98, 114 104 C126 135, 140 175, 148 220 Z" fill="url(#monkey-fur-grad)" stroke="#63391b" stroke-width="2" />
              <!-- Mano / Palma con dedos del monito -->
              <g id="monkey-hand-r">
                <ellipse cx="120" cy="86" rx="17" ry="15" fill="#8d5b36" stroke="#63391b" stroke-width="2" />
                <ellipse cx="120" cy="87" rx="11" ry="9" fill="#fed8a7" opacity="0.9" />
                <!-- Dedo 4 (Pulgar derecho) -->
                <ellipse cx="136" cy="91" rx="5" ry="7" transform="rotate(30 136 91)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="136" cy="91" rx="3" ry="4.5" transform="rotate(30 136 91)" fill="#fed8a7" />
                <!-- Dedo 3 (Índice derecho) -->
                <ellipse cx="129" cy="74" rx="5" ry="7.5" transform="rotate(15 129 74)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="129" cy="74" rx="3" ry="5" transform="rotate(15 129 74)" fill="#fed8a7" />
                <!-- Dedo 2 (Medio derecho) -->
                <ellipse cx="119" cy="72" rx="5.2" ry="8" transform="rotate(-2 119 72)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="119" cy="72" rx="3.2" ry="5.5" transform="rotate(-2 119 72)" fill="#fed8a7" />
                <!-- Dedo 1 (Anular derecho) -->
                <ellipse cx="109" cy="75" rx="5" ry="7.5" transform="rotate(-18 109 75)" fill="#8d5b36" stroke="#63391b" stroke-width="1.8" />
                <ellipse cx="109" cy="75" rx="3" ry="5" transform="rotate(-18 109 75)" fill="#fed8a7" />
              </g>
            </g>

          </g> <!-- /monkey-arms-container -->

        </g> <!-- /clip-path -->

        <!-- ARO Y BORDE EXTERIOR CON LOS COLORES DE FACILITOAPP -->
        <circle cx="100" cy="100" r="96" fill="none" stroke="url(#monkey-shirt-grad)" stroke-width="5" />
        <circle cx="100" cy="100" r="99" fill="none" stroke="rgba(255, 115, 0, 0.4)" stroke-width="1.5" />
      </svg>
    </div>
  `;
}
